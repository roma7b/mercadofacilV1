-- Add imagem_url to mercados_live
ALTER TABLE public.mercados_live ADD COLUMN IF NOT EXISTS imagem_url text;
