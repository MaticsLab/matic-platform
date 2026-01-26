package middleware

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

// PerformanceLoggingMiddleware logs slow requests for performance monitoring
// Logs any request that takes longer than the specified threshold
func PerformanceLoggingMiddleware(thresholdMs int) gin.HandlerFunc {
	threshold := time.Duration(thresholdMs) * time.Millisecond

	return func(c *gin.Context) {
		// Start timer
		start := time.Now()

		// Process request
		c.Next()

		// Calculate request duration
		duration := time.Since(start)

		// Log slow requests
		if duration > threshold {
			userID := c.GetString("user_id")
			if userID == "" {
				userID = "anonymous"
			}

			log.Printf(
				"[SLOW REQUEST] method=%s path=%s duration=%dms user_id=%s status=%d",
				c.Request.Method,
				c.Request.URL.Path,
				duration.Milliseconds(),
				userID,
				c.Writer.Status(),
			)
		}

		// Always log for debugging (can be conditionally enabled)
		if gin.Mode() == gin.DebugMode {
			log.Printf(
				"[REQUEST] method=%s path=%s duration=%dms status=%d",
				c.Request.Method,
				c.Request.URL.Path,
				duration.Milliseconds(),
				c.Writer.Status(),
			)
		}
	}
}

// RequestTimingMiddleware adds timing information to response headers
// Useful for frontend performance monitoring
func RequestTimingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		duration := time.Since(start)
		c.Header("X-Response-Time", duration.String())
		c.Header("X-Response-Time-Ms", string(rune(duration.Milliseconds())))
	}
}
