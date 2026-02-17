import postgres from 'postgres';

// Use your DATABASE_URL from .env.dev
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/postgres';
const sql = postgres(connectionString, { ssl: 'require' });

async function listTables() {
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `;
  console.log('Tables in public schema:');
  tables.forEach((row: any) => console.log(row.table_name));
  await sql.end();
}

listTables().catch((err) => {
  console.error('Error listing tables:', err);
  process.exit(1);
});
