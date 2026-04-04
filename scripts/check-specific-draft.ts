import postgres from 'postgres'
import * as dotenv from 'dotenv'
dotenv.config()

async function checkDraft() {
  const sql = postgres(process.env.POSTGRES_URL!)
  try {
    const draftId = '01KND1FWFKJ12K1S49H5239F27' // From logs
    const draft = await sql`
      SELECT id, created_by_user_id, title, status FROM event_creations WHERE id = ${draftId}
    `
    console.log('Draft encontrado:', draft)
    
    if (draft.length > 0) {
      const user = await sql`
        SELECT id, name, is_admin FROM users WHERE id = ${draft[0].created_by_user_id}
      `
      console.log('Dono do draft:', user)
    } else {
      console.log('Nenhum draft encontrado com esse ID.')
    }
  } catch (err) {
    console.error('Erro:', err)
  } finally {
    await sql.end()
  }
}

checkDraft()
