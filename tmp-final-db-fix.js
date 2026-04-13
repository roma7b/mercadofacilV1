const fs = require('node:fs')
const postgres = require('postgres')

const envContent = fs.readFileSync('.env', 'utf8')
const env = {}
envContent.split('\n').forEach((line) => {
  const parts = line.split('=')
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim()
  }
})

const sql = postgres(env.POSTGRES_URL)

async function fix() {
  try {
    console.log('Creating markets table...')
    await sql`
            CREATE TABLE IF NOT EXISTS markets (
              condition_id          TEXT PRIMARY KEY REFERENCES conditions (id) ON DELETE CASCADE ON UPDATE CASCADE,
              event_id              CHAR(26)    NOT NULL REFERENCES events (id) ON DELETE CASCADE ON UPDATE CASCADE,
              title                 TEXT        NOT NULL,
              slug                  TEXT        NOT NULL,
              short_title           TEXT,
              question              TEXT,
              market_rules          TEXT,
              resolution_source     TEXT,
              resolution_source_url TEXT,
              resolver              CHAR(42),
              neg_risk              BOOLEAN              DEFAULT FALSE NOT NULL,
              neg_risk_other        BOOLEAN              DEFAULT FALSE NOT NULL,
              neg_risk_market_id    CHAR(66),
              neg_risk_request_id   CHAR(66),
              metadata_version      TEXT,
              metadata_schema       TEXT,
              icon_url              TEXT,
              is_active             BOOLEAN              DEFAULT TRUE,
              is_resolved           BOOLEAN              DEFAULT FALSE,
              metadata              JSONB,
              volume_24h            DECIMAL(20, 6)       DEFAULT 0,
              volume                DECIMAL(20, 6)       DEFAULT 0,
              end_time              TIMESTAMPTZ,
              created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE (event_id, slug),
              CHECK (volume_24h >= 0),
              CHECK (volume >= 0)
            )
        `
    console.log('SUCCESS: Table markets created.')

    console.log('Creating views...')
    await sql`
          CREATE OR REPLACE VIEW v_main_tag_subcategories AS
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
        `
    console.log('SUCCESS: View created.')
  }
  catch (e) {
    console.error('ERROR:', e.message)
    console.error('Detail:', e.detail)
  }
  finally {
    await sql.end()
  }
}

fix()
