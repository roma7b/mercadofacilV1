-- Adiciona a coluna market_type para suportar CLOB vs LivePool
-- Data: 2026-04-08

ALTER TABLE events ADD COLUMN IF NOT EXISTS market_type TEXT;
ALTER TABLE event_creations ADD COLUMN IF NOT EXISTS market_type TEXT;

-- Atualizar registros existentes com base na heurística de slug (retrocompatibilidade)
UPDATE events SET market_type = 'livePool' WHERE slug LIKE 'live_%' AND market_type IS NULL;
UPDATE events SET market_type = 'clob' WHERE market_type IS NULL;

UPDATE event_creations SET market_type = 'livePool' WHERE slug LIKE 'live_%' AND market_type IS NULL;
UPDATE event_creations SET market_type = 'clob' WHERE market_type IS NULL;
