import { sql } from 'drizzle-orm'
import { db } from './src/lib/drizzle'

async function diagnose() {
  const tables = ['tags', 'event_tags', 'markets', 'events']
  for (const table of tables) {
    try {
      const res = await db.execute(sql`SELECT count(*) FROM ${sql.identifier(table)}`)
      console.log(`Table ${table}: EXISTS, count = ${res[0].count}`)
    }
    catch (e: any) {
      console.error(`Table ${table}: ERROR - ${e.message}`)
    }
  }
}

diagnose()
