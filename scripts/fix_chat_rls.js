const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixRLS() {
  console.log('Fixing RLS for chat_messages...')

  const sql = `
    -- Enable RLS
    ALTER TABLE IF EXISTS chat_messages ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if any to avoid errors
    DROP POLICY IF EXISTS "Public messages are viewable by everyone" ON chat_messages;
    DROP POLICY IF EXISTS "Users can create messages" ON chat_messages;
    DROP POLICY IF EXISTS "Public messages are insertable by everyone" ON chat_messages;

    -- Create new policies
    CREATE POLICY "Public messages are viewable by everyone" ON chat_messages FOR SELECT USING (true);
    CREATE POLICY "Public messages are insertable by everyone" ON chat_messages FOR INSERT WITH CHECK (true);
    
    -- Also ensure users table is readable if we want to join
    -- ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
    -- DROP POLICY IF EXISTS "Public users are viewable by everyone" ON users;
    -- CREATE POLICY "Public users are viewable by everyone" ON users FOR SELECT USING (true);
  `

  try {
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      console.log('Error via RPC (might not have exec_sql):', error.message)
      console.log('Falling back to direct SQL if possible or assuming migration script handles it.')
    }
    else {
      console.log('RLS policies updated successfully via RPC.')
    }
  }
  catch (err) {
    console.error('Catch error:', err)
  }
}

fixRLS()
