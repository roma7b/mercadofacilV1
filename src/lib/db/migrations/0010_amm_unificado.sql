-- Migration: Motor Parimutuel AMM Unificado
-- Executar manualmente no Supabase SQL Editor ou via Drizzle kit

-- 1. Novas colunas em mercados_live
ALTER TABLE mercados_live
  ADD COLUMN IF NOT EXISTS market_origin TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS polymarket_condition_id TEXT,
  ADD COLUMN IF NOT EXISTS polymarket_last_prob NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS polymarket_last_sync TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pool_seed_sim NUMERIC(20,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pool_seed_nao NUMERIC(20,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_reserve NUMERIC(20,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS guarantee_rate NUMERIC(5,4) DEFAULT 0.10;

-- Atualizar status existentes para incluir 'ABERTO'
-- (apenas documentação — o check é feito no código)

-- 2. Nova coluna em bets
ALTER TABLE bets
  ADD COLUMN IF NOT EXISTS payout_garantido NUMERIC(20,6) DEFAULT 0;

-- 3. Nova tabela bot_bets
CREATE TABLE IF NOT EXISTS bot_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id TEXT NOT NULL REFERENCES mercados_live(id) ON DELETE CASCADE,
  opcao TEXT NOT NULL,
  valor NUMERIC(20,6) NOT NULL,
  bot_type TEXT NOT NULL,
  prob_target NUMERIC(10,6),
  is_virtual BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_bot_bets_live_id ON bot_bets(live_id);
CREATE INDEX IF NOT EXISTS idx_bot_bets_bot_type ON bot_bets(bot_type);
CREATE INDEX IF NOT EXISTS idx_mercados_live_origin ON mercados_live(market_origin);
CREATE INDEX IF NOT EXISTS idx_mercados_live_polymarket_id ON mercados_live(polymarket_condition_id);
CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);
CREATE INDEX IF NOT EXISTS idx_bets_live_id ON bets(live_id);

-- 5. Seed inicial para mercados existentes (50/50 + seed de R$500)
-- Rodar apenas uma vez!
-- UPDATE mercados_live SET pool_seed_sim = 250, pool_seed_nao = 250 WHERE pool_seed_sim = 0;

-- Fim da migration
