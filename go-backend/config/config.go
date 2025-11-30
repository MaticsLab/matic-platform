package config

import (
	"os"
	"strings"
)

type Config struct {
	DatabaseURL            string
	Port                   string
	GinMode                string
	AllowedOrigins         []string
	JWTSecret              string
	SupabaseURL            string
	SupabaseKey            string
	SupabaseServiceRoleKey string
}

func LoadConfig() *Config {
	allowedOrigins := os.Getenv("ALLOWED_ORIGINS")
	origins := []string{
		"http://localhost:3000",
		"https://localhost:3000",
		"https://www.maticsapp.com",
		"https://maticsapp.com",
		"https://forms.maticsapp.com",
		"https://www.maticslab.com",
		"https://maticslab.com",
		"https://backend.maticslab.com",
		"https://matics-platform.vercel.app", // Fallback for Vercel preview deployments
	}
	if allowedOrigins != "" {
		origins = strings.Split(allowedOrigins, ",")
	}

	return &Config{
		DatabaseURL:            os.Getenv("DATABASE_URL"),
		Port:                   getEnv("PORT", "8000"),
		GinMode:                getEnv("GIN_MODE", "debug"),
		AllowedOrigins:         origins,
		JWTSecret:              getEnv("JWT_SECRET", "your-secret-key"),
		SupabaseURL:            os.Getenv("SUPABASE_URL"),
		SupabaseKey:            os.Getenv("SUPABASE_ANON_KEY"),
		SupabaseServiceRoleKey: os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
