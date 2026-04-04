-- ============================================================
-- Mercado Fácil Migration for Kuest
-- ============================================================

-- Märket Live Table
CREATE TABLE IF NOT EXISTS public.mercados_live (
  id                  text PRIMARY KEY,
  titulo              text NOT NULL,
  descricao           text,
  camera_url          text NOT NULL,
  tipo_contagem       text NOT NULL, -- 'VEICULOS' | 'PESSOAS' | 'OBJETOS'
  opcoes              jsonb,
  status              text NOT NULL DEFAULT 'AGUARDANDO', -- 'AGUARDANDO' | 'AO_VIVO' | 'RESOLVIDO'
  contagem_acumulada  integer DEFAULT 0,
  vencedor_label      text,
  volume              numeric(20, 6) DEFAULT 0,
  total_sim           numeric(14, 2) DEFAULT 0,
  total_nao           numeric(14, 2) DEFAULT 0,
  created_at          timestamptz DEFAULT NOW(),
  updated_at          timestamptz DEFAULT NOW()
);

-- Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               text NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  tipo                  text NOT NULL, -- 'DEPOSITO' | 'SAQUE' | 'APOSTA' | 'GANHO'
  valor                 numeric(14, 2) NOT NULL,
  status                text NOT NULL DEFAULT 'PENDENTE', -- 'PENDENTE' | 'CONFIRMADO' | 'FALHOU'
  referencia_externa    text,          -- ID do PIX, ID da aposta, etc.
  external_id_horsepay  bigint,
  created_at            timestamptz DEFAULT NOW()
);

-- Bets Table
CREATE TABLE IF NOT EXISTS public.bets (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   text NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  live_id                   text NOT NULL REFERENCES public.mercados_live(id) ON DELETE RESTRICT,
  opcao                     text NOT NULL, -- 'SIM' | 'NAO'
  valor                     numeric(14, 2) NOT NULL,
  cotas                     numeric(14, 6) NOT NULL,
  multiplicador_no_momento  numeric(10, 6) NOT NULL,
  status                    text NOT NULL DEFAULT 'PENDENTE', -- 'PENDENTE' | 'GANHOU' | 'PERDEU'
  created_at                timestamptz DEFAULT NOW()
);

-- Ensure wallets has saldo (Mercado Fácil balance)
-- Since Kuest's wallets table might already exist, we add columns if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallets' AND column_name='saldo') THEN
        ALTER TABLE public.wallets ADD COLUMN saldo numeric(14, 2) DEFAULT 0.00;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallets' AND column_name='updated_at') THEN
        ALTER TABLE public.wallets ADD COLUMN updated_at timestamptz DEFAULT NOW();
    END IF;
END $$;
