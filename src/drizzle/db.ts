import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "./schema"

const connectionString = process.env.BETTER_AUTH_DATABASE_URL || process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("[Drizzle] BETTER_AUTH_DATABASE_URL or DATABASE_URL must be set")
}

export const db = drizzle(connectionString, { schema })
