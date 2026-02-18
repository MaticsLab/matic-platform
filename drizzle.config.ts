import type { Config } from "drizzle-kit";

export default {
  schema: "./go-backend/models/*.go",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/postgres"
  }
} satisfies Config;
