import { bigint, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './auth/tables'

export const mercadosLive = pgTable('mercados_live', {
  id: text('id').primaryKey(),
  titulo: text('titulo').notNull(),
  descricao: text('descricao'),
  camera_url: text('camera_url'),
  tipo_contagem: text('tipo_contagem'), // 'VEICULOS' | 'PESSOAS' | 'OBJETOS'
  opcoes: jsonb('opcoes'),
  status: text('status').notNull().default('AGUARDANDO'), // 'AGUARDANDO' | 'AO_VIVO' | 'RESOLVIDO'
  contagem_acumulada: integer('contagem_acumulada').default(0),
  vencedor_label: text('vencedor_label'),
  total_sim: numeric('total_sim', { precision: 20, scale: 6 }).default('0'),
  total_nao: numeric('total_nao', { precision: 20, scale: 6 }).default('0'),
  volume: numeric('volume', { precision: 20, scale: 6 }).default('0'),
  volume_24h: numeric('volume_24h', { precision: 20, scale: 6 }).default('0'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const mercadoBets = pgTable('bets', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  live_id: text('live_id').references(() => mercadosLive.id, { onDelete: 'cascade' }), // Link com o mercado Mercado Fácil
  market_id: text('market_id'), // Link opcional com mercado Web3
  opcao: text('opcao').notNull(), // 'SIM' | 'NAO'
  valor: numeric('valor', { precision: 20, scale: 6 }).notNull(),
  cotas: numeric('cotas', { precision: 20, scale: 6 }).notNull(),
  multiplicador_no_momento: numeric('multiplicador_no_momento', { precision: 10, scale: 4 }).notNull(),
  status: text('status').notNull().default('PENDENTE'), // 'PENDENTE' | 'GANHOU' | 'PERDEU' | 'REEMBOLSADO'
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const mercadoWallets = pgTable('wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  saldo: numeric('saldo', { precision: 14, scale: 2 }).notNull().default('0.00'),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const mercadoTransactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  tipo: text('tipo').notNull(), // 'DEPOSITO' | 'SAQUE' | 'APOSTA' | 'GANHO'
  valor: numeric('valor', { precision: 14, scale: 2 }).notNull(),
  status: text('status').notNull().default('PENDENTE'), // 'PENDENTE' | 'CONFIRMADO' | 'FALHOU'
  referencia_externa: text('referencia_externa'), // ID do PIX, ID da aposta, etc.
  external_id_horsepay: bigint('external_id_horsepay', { mode: 'bigint' }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})



