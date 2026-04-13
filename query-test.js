const { Client } = require('pg')
require('dotenv').config()

const client = new Client({
  connectionString: process.env.DATABASE_URL,
})

async function main() {
  await client.connect()
  const res = await client.query('SELECT * FROM outcomes WHERE condition_id = \'cond-m3b7v73zpzjqu3gav5cso\'')
  console.log(res.rows)
  await client.end()
}

main().catch(console.error)
