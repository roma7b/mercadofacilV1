import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config()

async function setupDB() {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error("No postgres url found");
    return;
  }
  const sql = postgres(connectionString);
  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf TEXT;`;
    console.log("Column 'cpf' added or already exists.");
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

setupDB();
