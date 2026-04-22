import { sql } from 'drizzle-orm'
import { bigint, boolean, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './auth/tables'

export const mercadosLive = pgTable('mercados_live', {
  id: text('id').primaryKey(),
  titulo: text('titulo').notNull(),
  descricao: text('descricao'),
  camera_url: text('camera_url'),
  tipo_contagem: text('tipo_contagem'), // 'VEICULOS' | 'PESSOAS' | 'OBJETOS'
  opcoes: jsonb('opcoes'),
  status: text('status').notNull().default('AGUARDANDO'), // 'AGUARDANDO' | 'AO_VIVO' | 'RESOLVIDO' | 'ABERTO'
  contagem_acumulada: integer('contagem_acumulada').default(0),
  vencedor_label: text('vencedor_label'),

  // Pool de apostas reais (usuários)
  total_sim: numeric('total_sim', { precision: 20, scale: 6 }).default('0'),
  total_nao: numeric('total_nao', { precision: 20, scale: 6 }).default('0'),

  // Volume
  volume: numeric('volume', { precision: 20, scale: 6 }).default('0'),
  volume_24h: numeric('volume_24h', { precision: 20, scale: 6 }).default('0'),

  // ─── AMM UNIFICADO ─────────────────────────────────────────
  // Origem do mercado
  market_origin: text('market_origin').default('manual'), // 'manual' | 'livecam' | 'polymarket'

  // Polymarket (para mercados importados)
  polymarket_condition_id: text('polymarket_condition_id'),
  polymarket_last_prob: numeric('polymarket_last_prob', { precision: 10, scale: 6 }), // 0.0 a 1.0
  polymarket_last_sync: timestamp('polymarket_last_sync', { withTimezone: true }),

  // Pool sintético — volume do bot (NÃO afeta carteiras reais)
  pool_seed_sim: numeric('pool_seed_sim', { precision: 20, scale: 6 }).default('0'),
  pool_seed_nao: numeric('pool_seed_nao', { precision: 20, scale: 6 }).default('0'),

  // Fundo de garantia — reserva para cobrir payouts garantidos
  // Alimentado automaticamente com % de cada aposta
  payout_reserve: numeric('payout_reserve', { precision: 20, scale: 6 }).default('0'),

  // Taxa de reserva de garantia (padrão: 10% = 0.10)
  guarantee_rate: numeric('guarantee_rate', { precision: 5, scale: 4 }).default('0.10'),
  // ───────────────────────────────────────────────────────────

  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const mercadoBets = pgTable('bets', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  live_id: text('live_id').references(() => mercadosLive.id, { onDelete: 'cascade' }),
  market_id: text('market_id'), // Link opcional com mercado Web3 (legado)
  opcao: text('opcao').notNull(), // 'SIM' | 'NAO'
  valor: numeric('valor', { precision: 20, scale: 6 }).notNull(),
  cotas: numeric('cotas', { precision: 20, scale: 6 }).notNull(),
  // Multiplicador bloqueado no momento da aposta — GARANTIDO ao vencedor
  multiplicador_no_momento: numeric('multiplicador_no_momento', { precision: 10, scale: 4 }).notNull(),
  // Payout garantido = valor * multiplicador_no_momento
  payout_garantido: numeric('payout_garantido', { precision: 20, scale: 6 }).notNull().default('0'),
  status: text('status').notNull().default('PENDENTE'), // 'PENDENTE' | 'GANHOU' | 'PERDEU' | 'REEMBOLSADO'
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const mercadoWallets = pgTable('wallets', {
  id: text('id').primaryKey().default(sql`generate_ulid()`),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  address: text('address').notNull(),
  chain_id: integer('chain_id').notNull().default(0),
  is_primary: boolean('is_primary').default(true),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  saldo: numeric('saldo', { precision: 14, scale: 2 }).notNull().default('0.00'),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const mercadoTransactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  tipo: text('tipo').notNull(), // 'DEPOSITO' | 'SAQUE' | 'APOSTA' | 'GANHO' | 'TAXA' | 'RESERVA'
  valor: numeric('valor', { precision: 14, scale: 2 }).notNull(),
  status: text('status').notNull().default('PENDENTE'), // 'PENDENTE' | 'CONFIRMADO' | 'FALHOU'
  referencia_externa: text('referencia_externa'),
  external_id_horsepay: bigint('external_id_horsepay', { mode: 'bigint' }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ─── BOT SINTÉTICO ──────────────────────────────────────────────────────────
// Armazena apostas virtuais do bot para análise e auditoria.
// NÃO movimenta carteiras reais — apenas atualiza pool_seed_sim/pool_seed_nao.
export const botBets = pgTable('bot_bets', {
  id: uuid('id').primaryKey().defaultRandom(),
  live_id: text('live_id').notNull().references(() => mercadosLive.id, { onDelete: 'cascade' }),
  opcao: text('opcao').notNull(), // 'SIM' | 'NAO'
  valor: numeric('valor', { precision: 20, scale: 6 }).notNull(),
  // Tipo de bot que gerou esta aposta
  bot_type: text('bot_type').notNull(), // 'seeder' | 'oracle_adjust' | 'noise'
  // Prob alvo quando foi gerado (para auditoria de calibração)
  prob_target: numeric('prob_target', { precision: 10, scale: 6 }),
  is_virtual: boolean('is_virtual').default(true),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
