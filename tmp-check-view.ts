import { and, asc, eq } from 'drizzle-orm'
import { tags, v_main_tag_subcategories } from './src/lib/db/schema/events/tables'
import { db } from './src/lib/drizzle'

async function test() {
  try {
    console.log('Testing tags query...')
    const mainTagsResult = await db
      .select({
        id: tags.id,
        name: tags.name,
        slug: tags.slug,
      })
      .from(tags)
      .where(and(
        eq(tags.is_main_category, true),
        eq(tags.is_hidden, false),
      ))
      .orderBy(asc(tags.display_order), asc(tags.name))

    console.log('Main tags found:', mainTagsResult.length)
    if (mainTagsResult.length > 0) {
      console.log('First tag:', mainTagsResult[0])

      const mainSlugs = mainTagsResult.map(tag => tag.slug)

      console.log('Testing v_main_tag_subcategories query...')
      // Doing a raw SQL test first to see if view exists
      try {
        const rawResult = await db.execute('SELECT * FROM v_main_tag_subcategories LIMIT 1')
        console.log('Raw view query successful')
      }
      catch (e: any) {
        console.error('Raw view query FAILED:', e.message)
      }
    }
  }
  catch (e: any) {
    console.error('General failure:', e.message)
  }
  process.exit(0)
}

test()
