const postgres = require('postgres');
require('dotenv').config({ path: '.env' });

async function run() {
  const sql = postgres(process.env.POSTGRES_URL, { max: 1 });
  try {
    console.log('Adicionando colunas...');
    await sql.unsafe(`
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS id CHAR(26);
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS image TEXT;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{"trading":{"market_order_type":"FAK"},"notifications":{"email_resolutions":true,"inapp_order_fills":true,"inapp_resolutions":true,"inapp_hide_small_fills":true}}'::jsonb;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS proxy_wallet_address TEXT;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS proxy_wallet_signature TEXT;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS proxy_wallet_signed_at TIMESTAMPTZ;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS proxy_wallet_status TEXT NOT NULL DEFAULT 'not_started';
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS proxy_wallet_tx_hash TEXT;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS affiliate_code TEXT;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referred_by_user_id CHAR(26);
    `);
    console.log('Tabela users atualizada com sucesso!');
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    process.exit(0);
  }
}
run();
