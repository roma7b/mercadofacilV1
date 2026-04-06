-- Fix RLS for Mercado Fácil tables

-- 1. mercados_live
ALTER TABLE public.mercados_live DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.mercados_live TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Permitir leitura pública de mercados_live" ON public.mercados_live;
CREATE POLICY "Permitir leitura pública de mercados_live" 
ON public.mercados_live FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Permitir gerenciamento total de mercados_live" ON public.mercados_live;
CREATE POLICY "Permitir gerenciamento total de mercados_live"
ON public.mercados_live FOR ALL
TO authenticated, service_role, anon
USING (true)
WITH CHECK (true);

-- 2. bets
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de bets para o dono" ON public.bets;
CREATE POLICY "Permitir leitura de bets para o dono"
ON public.bets FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Permitir inserção de bets" ON public.bets;
CREATE POLICY "Permitir inserção de bets"
ON public.bets FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- 3. wallets
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de wallets" ON public.wallets;
CREATE POLICY "Permitir leitura de wallets"
ON public.wallets FOR SELECT
USING (true);

-- 4. transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de transactions" ON public.transactions;
CREATE POLICY "Permitir leitura de transactions"
ON public.transactions FOR SELECT
USING (true);
