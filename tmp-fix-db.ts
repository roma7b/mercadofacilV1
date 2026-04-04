
import { db } from './src/lib/drizzle';
import { sql } from 'drizzle-orm';

async function fix() {
  console.log('--- STARTING DATABASE FIX (WITH DROP) ---');
  
  try {
    console.log('Dropping existing view if any...');
    await db.execute(sql`DROP VIEW IF EXISTS v_main_tag_subcategories CASCADE`);
    console.log('View dropped.');

    console.log('Creating view v_main_tag_subcategories...');
    await db.execute(sql`
      CREATE VIEW v_main_tag_subcategories AS
      SELECT main_tag.id                    AS main_tag_id,
             main_tag.slug                  AS main_tag_slug,
             main_tag.name                  AS main_tag_name,
             main_tag.is_hidden             AS main_tag_is_hidden,
             sub_tag.id                     AS sub_tag_id,
             sub_tag.name                   AS sub_tag_name,
             sub_tag.slug                   AS sub_tag_slug,
             sub_tag.is_main_category       AS sub_tag_is_main_category,
             sub_tag.is_hidden              AS sub_tag_is_hidden,
             COUNT(DISTINCT m.condition_id) AS active_markets_count,
             MAX(m.updated_at)              AS last_market_activity_at
      FROM tags AS main_tag
             JOIN event_tags AS et_main
                  ON et_main.tag_id = main_tag.id
             JOIN markets AS m
                  ON m.event_id = et_main.event_id
             JOIN event_tags AS et_sub
                  ON et_sub.event_id = et_main.event_id
             JOIN tags AS sub_tag
                  ON sub_tag.id = et_sub.tag_id
      WHERE main_tag.is_main_category = TRUE
        AND main_tag.is_hidden = FALSE
        AND m.is_active = TRUE
        AND m.is_resolved = FALSE
        AND sub_tag.id <> main_tag.id
        AND sub_tag.is_main_category = FALSE
        AND sub_tag.is_hidden = FALSE
      GROUP BY main_tag.id,
               main_tag.slug,
               main_tag.name,
               main_tag.is_hidden,
               sub_tag.id,
               sub_tag.name,
               sub_tag.slug,
               sub_tag.is_main_category,
               sub_tag.is_hidden;
    `);
    console.log('SUCCESS: v_main_tag_subcategories created.');
  } catch (e: any) {
    console.error('CRITICAL ERROR:', e.message);
    if (e.detail) console.error('DETAIL:', e.detail);
    if (e.hint) console.error('HINT:', e.hint);
  }

  process.exit(0);
}

fix();
