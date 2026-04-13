const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const query = `
    SELECT 
      m.condition_id,
      m.title as market_title,
      o.outcome_text
    FROM events e
    JOIN markets m ON e.id = m.event_id
    LEFT JOIN outcomes o ON m.condition_id = o.condition_id
    WHERE e.slug = 'poly-wiep0-1775454327094'
  `
  const res = await pool.query(query)
  console.log(JSON.stringify(res.rows, null, 2))
  await pool.end()
}

main().catch(console.error)
