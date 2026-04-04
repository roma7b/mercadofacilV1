import { bigint, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './auth/tables'

export const mercadosLive = pgTable('mercados_live', {
  id: text('id').primaryKey(),
  titulo: text('titulo').notNull(),
  descricao: text('descricao'),
  camera_url: text('camera_url').notNull(),
  tipo_contagem: text('tipo_contagem').notNull(), // 'VEICULOS' | 'PESSOAS' | 'OBJETOS'
  opcoes: jsonb('opcoes'),
  status: text('status').notNull().default('AGUARDANDO'), // 'AGUARDANDO' | 'AO_VIVO' | 'RESOLVIDO'
  contagem_acumulada: integer('contagem_acumulada').default(0),
  vencedor_label: text('vencedor_label'),
  volume: numeric('volume', { precision: 20, scale: 6 }).default('0'),
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


