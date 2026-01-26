package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/Jsanchez767/matic-platform/config"
	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// BetterAuthClaims represents the claims in a Better Auth JWT token
type BetterAuthClaims struct {
	Sub   string `json:"sub"`              // User ID
	Email string `json:"email"`            // User email
	Name  string `json:"name"`             // User name
	Iss   string `json:"iss"`              // Issuer
	Aud   string `json:"aud"`              // Audience
	Exp   int64  `json:"exp"`              // Expiration
	Iat   int64  `json:"iat"`              // Issued at
	Sid   string `json:"sid"`              // Session ID
	OrgId string `json:"org_id,omitempty"` // Active organization ID
	jwt.RegisteredClaims
}

// AuthProvider indicates which auth system was used
type AuthProvider string

const (
	AuthProviderBetterAuth AuthProvider = "better-auth"
)

// Session cache for performance (matches Better Auth cookie cache duration)
var sessionCache sync.Map

// CachedSession wraps session with expiration time
type CachedSession struct {
	Session     models.BetterAuthSession
	CachedUntil time.Time
}

// Initialize cache cleanup goroutine
func init() {
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			now := time.Now()
			sessionCache.Range(func(key, value interface{}) bool {
				if cached, ok := value.(*CachedSession); ok {
					if now.After(cached.CachedUntil) {
						sessionCache.Delete(key)
					}
				}
				return true
			})
		}
	}()
}

// validateBetterAuthSessionToken checks if a token is a valid Better Auth session token
// by looking it up in the ba_sessions table with caching for performance
func validateBetterAuthSessionToken(token string) (*models.BetterAuthSession, bool) {
	// Check cache first (5 minute TTL matches Better Auth cookie cache)
	if cached, ok := sessionCache.Load(token); ok {
		cachedSession := cached.(*CachedSession)
		if time.Now().Before(cachedSession.CachedUntil) {
			// Return cached session (creates a copy to avoid mutation)
			session := cachedSession.Session
			return &session, true
		}
		// Expired cache entry
		sessionCache.Delete(token)
	}

	// Cache miss - query database
	var session models.BetterAuthSession

	result := database.DB.Preload("User").Where("token = ?", token).First(&session)
	if result.Error != nil {
		return nil, false
	}

	// Check if session is expired
	if session.IsExpired() {
		fmt.Println("⚠️ Better Auth session expired")
		return nil, false
	}

	// Cache the valid session for 5 minutes (matches Better Auth cookie cache)
	sessionCache.Store(token, &CachedSession{
		Session:     session,
		CachedUntil: time.Now().Add(5 * time.Minute),
	})

	return &session, true
}

// extractTokenFromRequest extracts the token from cookies (primary) or Authorization header (fallback)
// BETTER AUTH BEST PRACTICE: Prioritize cookies since Better Auth uses cookie-based session management
// Reference: https://www.better-auth.com/docs/concepts/session-management
func extractTokenFromRequest(c *gin.Context) string {
	// PRIMARY: Check cookies first (Better Auth standard for web apps)
	// Better Auth stores session tokens in HTTP-only cookies
	cookieNames := []string{
		"better-auth.session_token",          // Standard Better Auth cookie
		"__Secure-better-auth.session_token", // Secure variant (HTTPS only)
		"better-auth_session_token",
		"better_auth_session",
		"session_token",
	}

	for _, cookieName := range cookieNames {
		if cookie, err := c.Cookie(cookieName); err == nil && cookie != "" {
			// Better Auth session tokens are stored directly in the cookie
			// If using cookie cache strategies (compact/jwt/jwe), the token may contain periods
			// but the session token itself is before the first period
			if strings.Contains(cookie, ".") {
				return strings.Split(cookie, ".")[0]
			}
			return cookie
		}
	}

	// FALLBACK: Authorization header (for API clients & mobile apps)
	// Useful for programmatic access without cookies
	authHeader := c.GetHeader("Authorization")
	if authHeader != "" {
		parts := strings.Split(authHeader, " ")
		if len(parts) == 2 && parts[0] == "Bearer" {
			return parts[1]
		}
	}

	return ""
}

// AuthMiddleware validates Better Auth tokens only
// OPTIMIZATION: Simplified validation - prioritize session tokens (most common), then JWT
func AuthMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract token from Authorization header (primary) or cookies (fallback)
		tokenString := extractTokenFromRequest(c)
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization required. Please provide a token in the Authorization header or session cookie."})
			c.Abort()
			return
		}

		// PRIMARY: Validate as Better Auth session token (database lookup)
		// Session tokens are random strings stored in ba_sessions table (not JWTs)
		// This is the most common case for Better Auth
		if session, valid := validateBetterAuthSessionToken(tokenString); valid {
			c.Set("user_id", session.UserID)
			c.Set("userID", session.UserID)
			c.Set("user_email", session.User.Email)
			c.Set("user_name", session.User.Name)
			c.Set("auth_provider", AuthProviderBetterAuth)
			c.Set("session_id", session.ID)
			if session.ActiveOrganizationID != nil {
				c.Set("organization_id", *session.ActiveOrganizationID)
			}
			c.Next()
			return
		}

		// FALLBACK: Try JWT token validation (for API tokens or special cases)
		parser := new(jwt.Parser)
		betterAuthToken, _, betterAuthErr := parser.ParseUnverified(tokenString, &BetterAuthClaims{})

		if betterAuthErr == nil && betterAuthToken != nil {
			if _, ok := betterAuthToken.Claims.(*BetterAuthClaims); ok {
				// Verify Better Auth JWT token with secret
				verifiedToken, err := jwt.ParseWithClaims(tokenString, &BetterAuthClaims{}, func(token *jwt.Token) (interface{}, error) {
					return []byte(cfg.BetterAuthSecret), nil
				})

				if err == nil && verifiedToken.Valid {
					if verifiedClaims, ok := verifiedToken.Claims.(*BetterAuthClaims); ok {
						c.Set("user_id", verifiedClaims.Sub)
						c.Set("userID", verifiedClaims.Sub)
						c.Set("user_email", verifiedClaims.Email)
						c.Set("user_name", verifiedClaims.Name)
						c.Set("auth_provider", AuthProviderBetterAuth)
						c.Set("session_id", verifiedClaims.Sid)
						if verifiedClaims.OrgId != "" {
							c.Set("organization_id", verifiedClaims.OrgId)
						}
						c.Next()
						return
					}
				}
			}
		}

		// Token is invalid or expired
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
		c.Abort()
	}
}

// OptionalAuthMiddleware validates tokens if present, but allows requests without auth
func OptionalAuthMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			// No token, continue without auth
			c.Next()
			return
		}

		// Token present, validate it
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.Next()
			return
		}

		tokenString := parts[1]

		// First, try to validate as a Better Auth session token (database lookup)
		if session, valid := validateBetterAuthSessionToken(tokenString); valid {
			c.Set("user_id", session.UserID)
			c.Set("userID", session.UserID)
			c.Set("user_email", session.User.Email)
			c.Set("user_name", session.User.Name)
			c.Set("auth_provider", AuthProviderBetterAuth)
			c.Set("session_id", session.ID)
			if session.ActiveOrganizationID != nil {
				c.Set("organization_id", *session.ActiveOrganizationID)
			}
			c.Next()
			return
		}

		parser := new(jwt.Parser)

		// Try Better Auth JWT token
		betterAuthToken, _, betterAuthErr := parser.ParseUnverified(tokenString, &BetterAuthClaims{})
		if betterAuthErr == nil && betterAuthToken != nil {
			if claims, ok := betterAuthToken.Claims.(*BetterAuthClaims); ok {
				if claims.Sid != "" || strings.Contains(claims.Iss, "localhost:3000") || strings.Contains(claims.Iss, "maticsapp.com") {
					// Try to verify Better Auth token
					verifiedToken, err := jwt.ParseWithClaims(tokenString, &BetterAuthClaims{}, func(token *jwt.Token) (interface{}, error) {
						return []byte(cfg.BetterAuthSecret), nil
					})
					if err == nil && verifiedToken.Valid {
						if verifiedClaims, ok := verifiedToken.Claims.(*BetterAuthClaims); ok {
							c.Set("user_id", verifiedClaims.Sub)
							c.Set("userID", verifiedClaims.Sub)
							c.Set("user_email", verifiedClaims.Email)
							c.Set("user_name", verifiedClaims.Name)
							c.Set("auth_provider", AuthProviderBetterAuth)
							c.Set("session_id", verifiedClaims.Sid)
							if verifiedClaims.OrgId != "" {
								c.Set("organization_id", verifiedClaims.OrgId)
							}
							c.Next()
							return
						}
					}
				}
			}
		}

		// Token is invalid - Better Auth only

		c.Next()
	}
}

// GetUserID extracts the user ID from the context (set by AuthMiddleware)
func GetUserID(c *gin.Context) (string, bool) {
	userID, exists := c.Get("user_id")
	if !exists {
		return "", false
	}
	id, ok := userID.(string)
	return id, ok
}

// GetUserEmail extracts the user email from the context
func GetUserEmail(c *gin.Context) (string, bool) {
	email, exists := c.Get("user_email")
	if !exists {
		return "", false
	}
	e, ok := email.(string)
	return e, ok
}

// DebugTokenMiddleware logs token information (use only in development)
func DebugTokenMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 {
				// Decode token without validation to see claims
				token, _, _ := new(jwt.Parser).ParseUnverified(parts[1], &BetterAuthClaims{})
				if claims, ok := token.Claims.(*BetterAuthClaims); ok {
					claimsJSON, _ := json.MarshalIndent(claims, "", "  ")
					fmt.Printf("🔐 Token Claims:\n%s\n", string(claimsJSON))
				}
			}
		}
		c.Next()
	}
}
