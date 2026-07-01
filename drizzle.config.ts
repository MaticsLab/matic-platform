import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/drizzle/schema.ts",
  out: "./src/drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: (process.env.BETTER_AUTH_DATABASE_URL || process.env.DATABASE_URL)!,
  },
})
