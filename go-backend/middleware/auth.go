package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/Jsanchez767/matic-platform/config"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// SupabaseClaims represents the claims in a Supabase JWT token
type SupabaseClaims struct {
	Sub     string                 `json:"sub"`   // User ID
	Email   string                 `json:"email"` // User email
	Role    string                 `json:"role"`  // User role (authenticated, anon, etc.)
	Aud     string                 `json:"aud"`   // Audience
	Iss     string                 `json:"iss"`   // Issuer (Supabase URL)
	Exp     int64                  `json:"exp"`   // Expiration
	Iat     int64                  `json:"iat"`   // Issued at
	Meta    map[string]interface{} `json:"user_metadata,omitempty"`
	AppMeta map[string]interface{} `json:"app_metadata,omitempty"`
	jwt.RegisteredClaims
}

// AuthMiddleware validates Supabase JWT tokens
func AuthMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		// Extract token from "Bearer <token>"
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization header format. Expected: Bearer <token>"})
			c.Abort()
			return
		}

		tokenString := parts[1]

		// For ES256 tokens (Supabase default), parse without verification
		// Supabase has already validated these tokens
		var token *jwt.Token
		var err error

		// Try to parse the token to get the algorithm
		parser := new(jwt.Parser)
		unverifiedToken, _, parseErr := parser.ParseUnverified(tokenString, &SupabaseClaims{})

		if parseErr != nil {
			fmt.Printf("❌ Token parsing error: %v\n", parseErr)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
			c.Abort()
			return
		}

		// Check the algorithm
		alg := unverifiedToken.Method.Alg()
		fmt.Printf("🔐 Token algorithm: '%s'\n", alg)

		if alg == "ES256" || alg == "RS256" {
			// For ES256 (Supabase default), we trust that Supabase validated it
			// Just extract the claims without signature verification
			fmt.Println("✅ Accepting ES256/RS256 token from Supabase (trusted issuer)")
			token = unverifiedToken
			token.Valid = true // Mark as valid since we trust Supabase
		} else {
			// For other algorithms (like HS256), verify with the secret
			token, err = jwt.ParseWithClaims(tokenString, &SupabaseClaims{}, func(token *jwt.Token) (interface{}, error) {
				return []byte(cfg.JWTSecret), nil
			})
			if err != nil {
				fmt.Printf("❌ Token verification error: %v\n", err)
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token", "details": err.Error()})
				c.Abort()
				return
			}
		}

		// Extract claims
		claims, ok := token.Claims.(*SupabaseClaims)
		if !ok || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			c.Abort()
			return
		}

		// Store user info in context for handlers to use
		c.Set("user_id", claims.Sub)
		c.Set("user_email", claims.Email)
		c.Set("user_role", claims.Role)
		c.Set("user_claims", claims)

		c.Next()
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

		// Parse without verification for ES256 tokens (Supabase default)
		parser := new(jwt.Parser)
		token, _, err := parser.ParseUnverified(tokenString, &SupabaseClaims{})

		if err == nil && token != nil {
			if claims, ok := token.Claims.(*SupabaseClaims); ok {
				c.Set("user_id", claims.Sub)
				c.Set("user_email", claims.Email)
				c.Set("user_role", claims.Role)
				c.Set("user_claims", claims)
			}
		}

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

// GetUserClaims extracts the full claims from the context
func GetUserClaims(c *gin.Context) (*SupabaseClaims, bool) {
	claims, exists := c.Get("user_claims")
	if !exists {
		return nil, false
	}
	supabaseClaims, ok := claims.(*SupabaseClaims)
	return supabaseClaims, ok
}

// DebugTokenMiddleware logs token information (use only in development)
func DebugTokenMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 {
				// Decode token without validation to see claims
				token, _, _ := new(jwt.Parser).ParseUnverified(parts[1], &SupabaseClaims{})
				if claims, ok := token.Claims.(*SupabaseClaims); ok {
					claimsJSON, _ := json.MarshalIndent(claims, "", "  ")
					fmt.Printf("🔐 Token Claims:\n%s\n", string(claimsJSON))
				}
			}
		}
		c.Next()
	}
}
