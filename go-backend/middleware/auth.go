package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

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

// validateBetterAuthSessionToken checks if a token is a valid Better Auth session token
// by looking it up in the ba_sessions table
func validateBetterAuthSessionToken(token string) (*models.BetterAuthSession, bool) {
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

	return &session, true
}

// AuthMiddleware validates Better Auth tokens only
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

		// First, try to validate as a Better Auth session token (database lookup)
		// Better Auth session tokens are not JWTs - they're random strings stored in db
		if session, valid := validateBetterAuthSessionToken(tokenString); valid {
			fmt.Println("✅ Validated Better Auth session token via database")
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

		// Try to parse the token to determine the auth provider (JWT-based)
		parser := new(jwt.Parser)

		// Try parsing as Better Auth JWT token
		betterAuthToken, _, betterAuthErr := parser.ParseUnverified(tokenString, &BetterAuthClaims{})

		if betterAuthErr == nil && betterAuthToken != nil {
			if claims, ok := betterAuthToken.Claims.(*BetterAuthClaims); ok {
				// Check if this looks like a Better Auth token (has session ID or specific issuer)
				if claims.Sid != "" || strings.Contains(claims.Iss, "localhost:3000") || strings.Contains(claims.Iss, "maticsapp.com") {
					// Verify Better Auth token with secret
					verifiedToken, err := jwt.ParseWithClaims(tokenString, &BetterAuthClaims{}, func(token *jwt.Token) (interface{}, error) {
						return []byte(cfg.BetterAuthSecret), nil
					})

					if err == nil && verifiedToken.Valid {
						if verifiedClaims, ok := verifiedToken.Claims.(*BetterAuthClaims); ok {
							fmt.Println("✅ Validated Better Auth JWT token")
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

		// Token is invalid or not a Better Auth token
		fmt.Printf("❌ Token validation failed: Invalid or expired Better Auth token\n")
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
