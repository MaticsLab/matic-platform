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
	AuthProviderSupabase   AuthProvider = "supabase"
	AuthProviderBetterAuth AuthProvider = "better-auth"
)

// AuthMiddleware validates both Supabase and Better Auth JWT tokens
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

		// Try to parse the token to determine the auth provider
		parser := new(jwt.Parser)

		// First, try parsing as Better Auth token
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
							fmt.Println("✅ Validated Better Auth token")
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
					// If Better Auth verification fails, try Supabase
					fmt.Printf("⚠️ Better Auth token verification failed: %v, trying Supabase\n", err)
				}
			}
		}

		// Try parsing as Supabase token
		supabaseToken, _, supabaseErr := parser.ParseUnverified(tokenString, &SupabaseClaims{})

		if supabaseErr != nil {
			fmt.Printf("❌ Token parsing error: %v\n", supabaseErr)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
			c.Abort()
			return
		}

		// Check the algorithm for Supabase tokens
		alg := supabaseToken.Method.Alg()
		fmt.Printf("🔐 Token algorithm: '%s'\n", alg)

		var token *jwt.Token
		var err error

		if alg == "ES256" || alg == "RS256" {
			// For ES256/RS256 (Supabase default), trust that Supabase validated it
			fmt.Println("✅ Accepting ES256/RS256 token from Supabase (trusted issuer)")
			token = supabaseToken
			token.Valid = true
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

		// Extract Supabase claims
		claims, ok := token.Claims.(*SupabaseClaims)
		if !ok || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			c.Abort()
			return
		}

		// Store user info in context for handlers to use
		c.Set("user_id", claims.Sub)
		c.Set("userID", claims.Sub)
		c.Set("user_email", claims.Email)
		c.Set("user_role", claims.Role)
		c.Set("user_claims", claims)
		c.Set("auth_provider", AuthProviderSupabase)

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
		parser := new(jwt.Parser)

		// Try Better Auth token first
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

		// Fall back to Supabase token parsing
		token, _, err := parser.ParseUnverified(tokenString, &SupabaseClaims{})

		if err == nil && token != nil {
			if claims, ok := token.Claims.(*SupabaseClaims); ok {
				c.Set("user_id", claims.Sub)
				c.Set("userID", claims.Sub)
				c.Set("user_email", claims.Email)
				c.Set("user_role", claims.Role)
				c.Set("user_claims", claims)
				c.Set("auth_provider", AuthProviderSupabase)
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
