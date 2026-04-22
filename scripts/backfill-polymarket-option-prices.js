const { createClient } = require('@supabase/supabase-js')

const POLYMARKET_GAMMA_API = 'https://gamma-api.polymarket.com'

async function fetchPolymarketMarketByConditionId(conditionId) {
  try {
    const url = `${POLYMARKET_GAMMA_API}/markets?condition_id=${conditionId}`
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return Array.isArray(data) ? (data[0] || null) : null
  }
  catch {
    return null
  }
}

function enrichOptionsWithPrices(opcoes, outcomePrices) {
  if (!opcoes || typeof opcoes !== 'object') {
    return null
  }

  const prices = Array.isArray(outcomePrices)
    ? outcomePrices
    : typeof outcomePrices === 'string'
      ? JSON.parse(outcomePrices)
      : []
  if (prices.length === 0) {
    return null
  }

  return Object.fromEntries(
    Object.entries(opcoes).map(([key, value], index) => {
      const currentValue = value && typeof value === 'object'
        ? { ...value }
        : { text: String(value || '') }
      const numericPrice = Number(prices[index])

      return [key, {
        ...currentValue,
        price: Number.isFinite(numericPrice) ? numericPrice : currentValue.price ?? null,
      }]
    }),
  )
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables.')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: rows, error } = await supabase
    .from('mercados_live')
    .select('id, titulo, polymarket_condition_id, opcoes')
    .eq('market_origin', 'polymarket')

  if (error) {
    throw error
  }

  const candidates = (rows || []).filter((row) => {
    const opcoes = row.opcoes && typeof row.opcoes === 'object' ? Object.values(row.opcoes) : []
    if (opcoes.length === 0 || !row.polymarket_condition_id) {
      return false
    }

    return opcoes.some((value) => {
      const numeric = Number(value && value.price)
      return !Number.isFinite(numeric)
    })
  })

  console.log(`Found ${candidates.length} polymarket markets missing option prices.`)

  let updated = 0
  let skipped = 0

  for (const row of candidates) {
    const polyMarket = await fetchPolymarketMarketByConditionId(String(row.polymarket_condition_id))
    const enrichedOptions = enrichOptionsWithPrices(row.opcoes, polyMarket?.outcomePrices)

    if (!enrichedOptions) {
      skipped += 1
      console.log(`Skipping ${row.id} (${row.titulo}) - no outcomePrices available.`)
      continue
    }

    const { error: updateError } = await supabase
      .from('mercados_live')
      .update({
        opcoes: enrichedOptions,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    if (updateError) {
      skipped += 1
      console.log(`Failed updating ${row.id} (${row.titulo}) - ${updateError.message}`)
      continue
    }

    updated += 1
    console.log(`Updated ${row.id} (${row.titulo})`)
  }

  console.log(JSON.stringify({ updated, skipped, total: candidates.length }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
