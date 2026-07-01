package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/Jsanchez767/matic-platform/config"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// Realtime collaboration relay (replaces Supabase Realtime broadcast+presence).
//
// This is a pure relay: it does not understand or persist Yjs document content, it
// only forwards opaque "yjs-update"/"awareness-update" messages between clients in
// the same room and tracks room membership for presence. State is kept in memory on
// this single process — the backend service MUST stay pinned to 1 replica, or
// clients connected to different replicas would never see each other.

const (
	wsWriteWait      = 10 * time.Second
	wsPongWait       = 60 * time.Second
	wsPingPeriod     = (wsPongWait * 9) / 10
	wsMaxMessageSize = 512 * 1024 // 512KB — generous for batched Yjs updates
)

var wsUpgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		// CORS-equivalent check for the WS upgrade (browsers don't send
		// preflight for WS, so this is the only origin check that applies).
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true // non-browser clients (no Origin header)
		}
		if strings.HasPrefix(origin, "http://localhost") {
			return true
		}
		if strings.HasSuffix(origin, ".maticsapp.com") || origin == "https://maticsapp.com" {
			return true
		}
		if strings.HasSuffix(origin, ".up.railway.app") {
			return true
		}
		return false
	},
}

type wsUser struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Color     string `json:"color"`
	AvatarURL string `json:"avatarUrl,omitempty"`
}

type wsClient struct {
	conn *websocket.Conn
	send chan []byte
	room *wsRoom
	user wsUser
}

type wsRoom struct {
	mu      sync.Mutex
	clients map[*wsClient]bool
}

func (r *wsRoom) users() []wsUser {
	r.mu.Lock()
	defer r.mu.Unlock()
	users := make([]wsUser, 0, len(r.clients))
	for c := range r.clients {
		users = append(users, c.user)
	}
	return users
}

func (r *wsRoom) broadcastPresence() {
	payload, err := json.Marshal(map[string]interface{}{
		"type":  "presence",
		"users": r.users(),
	})
	if err != nil {
		return
	}
	r.broadcast(nil, payload)
}

// broadcast sends msg to every client in the room except `exclude`.
func (r *wsRoom) broadcast(exclude *wsClient, msg []byte) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for c := range r.clients {
		if c == exclude {
			continue
		}
		select {
		case c.send <- msg:
		default:
			// Client's send buffer is full (slow/dead connection) — drop it
			// rather than blocking the whole room.
			close(c.send)
			delete(r.clients, c)
		}
	}
}

var (
	wsRoomsMu sync.Mutex
	wsRooms   = map[string]*wsRoom{}
)

func getOrCreateRoom(roomID string) *wsRoom {
	wsRoomsMu.Lock()
	defer wsRoomsMu.Unlock()
	room, ok := wsRooms[roomID]
	if !ok {
		room = &wsRoom{clients: map[*wsClient]bool{}}
		wsRooms[roomID] = room
	}
	return room
}

func removeRoomIfEmpty(roomID string, room *wsRoom) {
	room.mu.Lock()
	empty := len(room.clients) == 0
	room.mu.Unlock()
	if !empty {
		return
	}
	wsRoomsMu.Lock()
	defer wsRoomsMu.Unlock()
	if current, ok := wsRooms[roomID]; ok && current == room {
		delete(wsRooms, roomID)
	}
}

// wsAuthenticate validates the session for a WebSocket upgrade request. Browsers'
// native WebSocket API can't set an Authorization header, so unlike normal API
// requests this also accepts the token as a query parameter for cross-domain use
// (pre-DNS-cutover Railway domains, where the session cookie's domain doesn't match).
func wsAuthenticate(c *gin.Context) (userID string, ok bool) {
	if cookie, err := c.Cookie("better-auth.session_token"); err == nil && cookie != "" {
		token := strings.Split(cookie, ".")[0]
		if session, valid := middleware.ValidateSessionToken(token); valid {
			return session.UserID, true
		}
	}
	if auth := c.GetHeader("Authorization"); auth != "" {
		parts := strings.Split(auth, " ")
		if len(parts) == 2 && parts[0] == "Bearer" {
			if session, valid := middleware.ValidateSessionToken(parts[1]); valid {
				return session.UserID, true
			}
		}
	}
	if token := c.Query("token"); token != "" {
		if session, valid := middleware.ValidateSessionToken(token); valid {
			return session.UserID, true
		}
	}
	return "", false
}

// HandleCollaborationWebSocket upgrades to a WebSocket and relays Yjs/awareness
// messages within a room. GET /ws/collaboration/:roomId
func HandleCollaborationWebSocket(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		roomID := c.Param("roomId")
		if roomID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "roomId is required"})
			return
		}

		if _, ok := wsAuthenticate(c); !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization required"})
			return
		}

		conn, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("[WS] upgrade failed: %v", err)
			return
		}

		room := getOrCreateRoom(roomID)
		client := &wsClient{
			conn: conn,
			send: make(chan []byte, 64),
			room: room,
		}

		go client.writePump()
		client.readPump(room, roomID)
	}
}

func (c *wsClient) readPump(room *wsRoom, roomID string) {
	defer func() {
		room.mu.Lock()
		delete(room.clients, c)
		room.mu.Unlock()
		close(c.send)
		c.conn.Close()
		room.broadcastPresence()
		removeRoomIfEmpty(roomID, room)
	}()

	c.conn.SetReadLimit(wsMaxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(wsPongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(wsPongWait))
		return nil
	})

	joined := false

	for {
		_, msg, err := c.conn.ReadMessage()
		if err != nil {
			return
		}

		var envelope struct {
			Type string `json:"type"`
			User wsUser `json:"user"`
		}
		if err := json.Unmarshal(msg, &envelope); err != nil {
			continue
		}

		if envelope.Type == "join" {
			c.user = envelope.User
			if !joined {
				joined = true
				room.mu.Lock()
				room.clients[c] = true
				room.mu.Unlock()
			}
			room.broadcastPresence()
			continue
		}

		if !joined {
			// Ignore updates from clients that haven't sent "join" yet.
			continue
		}

		// Opaque relay — yjs-update / awareness-update payloads are forwarded
		// verbatim to everyone else in the room.
		room.broadcast(c, msg)
	}
}

func (c *wsClient) writePump() {
	ticker := time.NewTicker(wsPingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(wsWriteWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(wsWriteWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
