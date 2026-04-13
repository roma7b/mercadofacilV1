import { eq, or } from 'drizzle-orm'
import { events, markets } from '../src/lib/db/schema'
import { db } from '../src/lib/drizzle'

async function main() {
  console.log('Searching for 01KND...1RM...')
  const idToRemove = '01KND7V3Y9SVF0RCPC68ZYE1RM'

  const inEvents = await db.select().from(events).where(or(eq(events.id, idToRemove), eq(events.slug, idToRemove)))
  console.log('in events:', inEvents.length, inEvents.map(e => e.id))

  const inMarkets = await db.select().from(markets).where(or(eq(markets.condition_id, idToRemove), eq(markets.slug, idToRemove), eq(markets.event_id, idToRemove)))
  console.log('in markets:', inMarkets.length, inMarkets.map(m => m.condition_id))

  process.exit(0)
}

main()
