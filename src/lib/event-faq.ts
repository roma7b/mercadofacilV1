import type { Event, Market, Outcome } from '@/types'
import { OUTCOME_INDEX } from '@/lib/constants'
import { formatCompactCount, formatDate } from '@/lib/formatters'

export interface EventFaqItem {
  id: string
  question: string
  answer: string
}

interface BuildEventFaqItemsOptions {
  event: Event
  siteName: string
  commentsCount?: number | null
}

interface FaqSelection {
  label: string
  cents: number
}

const LOW_VOLUME_THRESHOLD = 10_000
const ACTIVE_COMMENTS_THRESHOLD = 10
const CENTS_FORMATTER = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

function quoteLabel(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? `"${normalized}"` : '"este mercado"'
}

function clampCents(value: number) {
  if (!Number.isFinite(value)) {
    return 50
  }

  return Math.max(0, Math.min(100, Math.round(value * 10) / 10))
}

function formatFaqCents(value: number) {
  return `${CENTS_FORMATTER.format(clampCents(value))}¢`
}

function formatPercentFromCents(cents: number) {
  return `${Math.round(clampCents(cents))}%`
}

function formatFaqCurrency(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 'R$ 0'
  }

  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    const display = Number.isInteger(Math.round(millions)) && Math.abs(millions - Math.round(millions)) < 0.05
      ? `${Math.round(millions)}`
      : millions.toFixed(1).replace(/\.0$/, '').replace('.', ',')
    return `R$ ${display} milhões`
  }

  if (value >= 1_000) {
    return `R$ ${(value / 1_000).toFixed(1).replace(/\.0$/, '').replace('.', ',')}K`
  }

  return `R$ ${Math.round(value)}`
}

function formatMonthDayYear(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return formatDate(date)
}

function resolveMarketLabel(market: Market) {
  return market.short_title?.trim() || market.title?.trim() || 'este resultado'
}

function resolveMarketPriceCents(market: Market) {
  if (Number.isFinite(market.price)) {
    return clampCents(market.price * 100)
  }

  if (Number.isFinite(market.probability)) {
    return clampCents(market.probability)
  }

  return 50
}

function resolveOutcomePriceCents(outcome: Outcome, market: Market) {
  if (Number.isFinite(outcome.buy_price)) {
    return clampCents(Number(outcome.buy_price) * 100)
  }

  const yesCents = resolveMarketPriceCents(market)
  if (outcome.outcome_index === OUTCOME_INDEX.YES) {
    return yesCents
  }

  if (outcome.outcome_index === OUTCOME_INDEX.NO) {
    return clampCents(100 - yesCents)
  }

  return null
}

function resolveTotalMarketsCount(event: Event) {
  return Math.max(event.total_markets_count ?? 0, event.markets.length)
}

function isBinaryEvent(event: Event) {
  return resolveTotalMarketsCount(event) <= 1
}

function isResolvedEvent(event: Event) {
  return event.status === 'resolved'
    || Boolean(event.resolved_at)
    || (event.markets.length > 0 && event.markets.every(market => market.is_resolved || market.condition?.resolved))
}

function resolveBinaryYesCents(event: Event) {
  const market = event.markets[0]
  if (!market) {
    return 50
  }

  const yesOutcome = market.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.YES) ?? null
  if (!yesOutcome) {
    return resolveMarketPriceCents(market)
  }

  return resolveOutcomePriceCents(yesOutcome, market) ?? resolveMarketPriceCents(market)
}

function resolveBinarySelection(event: Event): FaqSelection {
  return {
    label: 'Sim',
    cents: resolveBinaryYesCents(event),
  }
}

function resolveFrontRunnerSelections(event: Event) {
  return Array.from(event.markets, market => ({
    label: resolveMarketLabel(market),
    cents: resolveMarketPriceCents(market),
  }))
    .sort((left, right) => right.cents - left.cents)
}

function resolvePrimarySelection(event: Event) {
  if (isBinaryEvent(event)) {
    return resolveBinarySelection(event)
  }

  return resolveFrontRunnerSelections(event)[0] ?? {
    label: 'este resultado',
    cents: 50,
  }
}

function formatChoice(selection: FaqSelection) {
  return `${quoteLabel(selection.label)} a ${formatFaqCents(selection.cents)} (${formatPercentFromCents(selection.cents)} de probabilidade implícita)`
}

function buildSiteAccuracySentence(siteName: string) {
  return ` Mercados de previsão como o ${siteName} tendem a se tornar mais informativos conforme os eventos se aproximam da resolução e mais traders participam.`
}

function buildWhatIsBinaryAnswer(event: Event, siteName: string) {
  const yesSelection = resolveBinarySelection(event)

  return `${quoteLabel(event.title)} é um mercado de previsão no ${siteName} onde os traders compram e vendem ações de "Sim" ou "Não" com base em se acreditam que este evento acontecerá. A probabilidade atual da multidão é de ${formatPercentFromCents(yesSelection.cents)} para "Sim". Por exemplo, se o "Sim" estiver cotado a ${formatFaqCents(yesSelection.cents)}, o mercado atribui coletivamente uma chance de ${formatPercentFromCents(yesSelection.cents)} de que este evento ocorra. Essas probabilidades mudam continuamente à medida que os traders reagem a novos desenvolvimentos e informações. As ações no resultado correto podem ser resgatadas por R$ 1 cada na resolução do mercado.`
}

function buildWhatIsMultiAnswer(event: Event, siteName: string) {
  const frontRunners = resolveFrontRunnerSelections(event)
  const leader = frontRunners[0] ?? null
  const runnerUp = frontRunners[1] ?? null
  const leaderSentence = leader
    ? ` O resultado líder atual é ${formatChoice(leader)}.`
    : ''
  const runnerUpSentence = runnerUp
    ? ` O próximo resultado mais próximo é ${formatChoice(runnerUp)}.`
    : ''
  const exampleSelection = leader ?? runnerUp ?? { label: 'este resultado', cents: 50 }

  return `${quoteLabel(event.title)} é um mercado de previsão no ${siteName} com ${resolveTotalMarketsCount(event)} resultados possíveis onde os traders compram e vendem ações com base no que acreditam que acontecerá.${leaderSentence}${runnerUpSentence} Os preços refletem as probabilidades em tempo real da multidão. Por exemplo, uma ação cotada a ${formatFaqCents(exampleSelection.cents)} implica que o mercado atribui coletivamente uma chance de ${formatPercentFromCents(exampleSelection.cents)} a esse resultado. Essas probabilidades mudam continuamente à medida que os traders reagem a novos desenvolvimentos e informações. As ações no resultado correto podem ser resgatadas por R$ 1 cada na resolução do mercado.`
}

function buildLowVolumeAnswer(event: Event) {
  const createdAtLabel = formatMonthDayYear(event.created_at)
  const launchedText = createdAtLabel ? `, lançado em ${createdAtLabel}` : ''

  return `${quoteLabel(event.title)} é um mercado recém-criado${launchedText}. Como um mercado inicial, esta é a sua oportunidade de estar entre os primeiros traders a definir as probabilidades e estabelecer os sinais de preço iniciais do mercado. Você também pode marcar esta página para acompanhar o volume e a atividade de negociação conforme o mercado ganha tração ao longo do tempo.`
}

function buildStandardVolumeAnswer(event: Event, siteName: string) {
  const createdAtLabel = formatMonthDayYear(event.created_at)
  const launchedText = createdAtLabel ? ` desde que o mercado foi lançado em ${createdAtLabel}` : ''

  return `Até hoje, ${quoteLabel(event.title)} gerou ${formatFaqCurrency(event.volume)} em volume total de negociação${launchedText}. Esse nível de atividade reflete o forte engajamento da comunidade do ${siteName} e ajuda a garantir que as probabilidades atuais sejam informadas por um profundo pool de participantes. Você pode acompanhar movimentos de preço ao vivo e negociar em qualquer resultado diretamente nesta página.`
}

function buildTradeBinaryAnswer(event: Event) {
  return `Para negociar no ${quoteLabel(event.title)}, basta escolher se você acredita que a resposta será "Sim" ou "Não". Cada lado tem um preço atual que reflete a probabilidade implícita do mercado. Insira sua quantia e clique em "Negociar". Se você comprar ações de "Sim" e o resultado for resolvido como "Sim", cada ação paga R$ 1. Se for resolvido como "Não", suas ações de "Sim" pagam R$ 0. Você também pode vender suas ações a qualquer momento antes da resolução se quiser garantir um lucro ou cortar um prejuízo.`
}

function buildTradeMultiAnswer(event: Event) {
  return `Para negociar no ${quoteLabel(event.title)}, navegue pelos ${resolveTotalMarketsCount(event)} resultados disponíveis listados nesta página. Cada resultado exibe um preço atual que representa a probabilidade implícita do mercado. Para assumir uma posição, selecione o resultado que você acredita ser mais provável, escolha "Sim" para negociar a favor dele ou "No" para negociar contra ele, insira sua quantia e clique em "Negociar". Se o resultado escolhido estiver correto quando o mercado for resolvido, suas ações de "Sim" pagam R$ 1 cada. Se estiver incorreto, elas pagam R$ 0. Você também pode vender suas ações a qualquer momento antes da resolução se quiser garantir um lucro ou cortar um prejuízo.`
}

function buildCurrentOddsBinaryAnswer(event: Event, siteName: string) {
  const yesSelection = resolveBinarySelection(event)

  return `A probabilidade atual para ${quoteLabel(event.title)} é de ${formatPercentFromCents(yesSelection.cents)} para "Sim". Isso significa que a multidão do ${siteName} acredita atualmente que há uma chance de ${formatPercentFromCents(yesSelection.cents)} de que este evento ocorra. Essas probabilidades são atualizadas em tempo real com base em negociações reais, fornecendo um sinal continuamente atualizado do que o mercado espera que aconteça.`
}

function buildCurrentOddsMultiAnswer(event: Event) {
  const frontRunners = resolveFrontRunnerSelections(event)
  const leader = frontRunners[0] ?? null
  const runnerUp = frontRunners[1] ?? null
  const leaderSentence = leader
    ? `O líder atual para ${quoteLabel(event.title)} é ${formatChoice(leader)}, o que significa que o mercado atribui uma chance de ${formatPercentFromCents(leader.cents)} a esse resultado.`
    : `Os preços atuais para ${quoteLabel(event.title)} são atualizados em tempo real nesta página.`
  const runnerUpSentence = runnerUp
    ? ` O próximo resultado mais próximo é ${formatChoice(runnerUp)}.`
    : ''

  return `${leaderSentence}${runnerUpSentence} Essas probabilidades são atualizadas em tempo real conforme os traders compram e vendem ações, refletindo a visão coletiva mais recente do que é mais provável de acontecer. Volte com frequência ou marque esta página para acompanhar como as probabilidades mudam à medida que novas informações surgem.`
}

function buildResolutionAnswer(event: Event) {
  return `As regras de resolução para ${quoteLabel(event.title)} definem exatamente o que precisa acontecer para que cada resultado seja declarado vencedor, incluindo as fontes de dados oficiais usadas para determinar o resultado. Você pode revisar os critérios de resolução completos na seção "Regras" nesta página, acima dos comentários. Recomendamos ler as regras cuidadosamente antes de negociar, pois elas especificam as condições precisas, casos excepcionais e fontes que regem como este mercado é liquidado.`
}

function buildFollowAnswer(event: Event) {
  return `Sim. Você não precisa negociar para se manter informado. Esta página serve como um rastreador ao vivo para ${quoteLabel(event.title)}. As probabilidades de resultado são atualizadas em tempo real conforme novas negociações ocorrem. Você pode marcar esta página e verificar a seção de comentários para ver o que outros traders estão dizendo. Você também pode usar os filtros de intervalo de tempo no gráfico para ver como as probabilidades mudaram ao longo do tempo. É uma janela gratuita e em tempo real para o que o mercado espera que aconteça.`
}

function buildReliabilityAnswer(event: Event, siteName: string) {
  return `As probabilidades do ${siteName} são definidas por traders reais colocando dinheiro real em suas crenças, o que tende a produzir previsões precisas. Com ${formatFaqCurrency(event.volume)} negociados em ${quoteLabel(event.title)}, esses preços agregam o conhecimento coletivo e a convicção de milhares de participantes, muitas vezes superando pesquisas, previsões de especialistas e levantamentos tradicionais.${buildSiteAccuracySentence(siteName)}`
}

function buildStartTradingAnswer(event: Event, siteName: string) {
  return `Para fazer sua primeira negociação em ${quoteLabel(event.title)}, crie uma conta gratuita no ${siteName} e adicione fundos usando cripto, um cartão de crédito ou débito, ou transferência bancária. Assim que sua conta tiver fundos, volte a esta página, selecione o resultado que deseja negociar, insira sua quantia e clique em "Negociar". Se você é novo em mercados de previsão, clique no link "Como funciona" no topo de qualquer página do ${siteName} para um guia rápido de como as negociações funcionam.`
}

function buildPriceMeaningBinaryAnswer(event: Event, siteName: string) {
  const yesSelection = resolveBinarySelection(event)
  const profitCents = clampCents(100 - yesSelection.cents)

  return `No ${siteName}, o preço de "Sim" ou "Não" representa a probabilidade implícita do mercado. Um preço de "Sim" de ${formatFaqCents(yesSelection.cents)} para ${quoteLabel(event.title)} significa que os traders acreditam coletivamente que há uma chance de ${formatPercentFromCents(yesSelection.cents)} deste evento acontecer. Se você comprar "Sim" a ${formatFaqCents(yesSelection.cents)} e o evento de fato ocorrer, você recebe R$ 1,00 por ação — um lucro de ${formatFaqCents(profitCents)} por ação. Se o evento não acontecer, essas ações valerão R$ 0.`
}

function buildPriceMeaningMultiAnswer(event: Event, siteName: string) {
  const selection = resolvePrimarySelection(event)
  const profitCents = clampCents(100 - selection.cents)

  return `No ${siteName}, o preço de cada resultado representa a probabilidade implícita do mercado. Um preço de ${formatFaqCents(selection.cents)} para ${quoteLabel(selection.label)} no mercado ${quoteLabel(event.title)} significa que os traders acreditam coletivamente que há aproximadamente ${formatPercentFromCents(selection.cents)} de chance de que ${quoteLabel(selection.label)} seja o resultado correto. Se você comprar ações de "Sim" a ${formatFaqCents(selection.cents)} e o resultado estiver correto, você recebe R$ 1,00 por ação — um lucro de ${formatFaqCents(profitCents)} por ação. Se incorreto, essas ações valerão R$ 0.`
}

function buildCloseAnswer(event: Event) {
  if (isResolvedEvent(event)) {
    return `O mercado ${quoteLabel(event.title)} foi resolvido. O resultado final já foi determinado e o mercado não está mais aberto para negociações. Você ainda pode revisar o histórico de probabilidades, as chances dos resultados e os comentários nesta página para ver como a previsão evoluiu ao longo do tempo.`
  }

  const closeDate = formatMonthDayYear(event.end_date ?? event.resolved_at ?? event.start_date)
  if (!closeDate) {
    return `O mercado ${quoteLabel(event.title)} permanece aberto até que o resultado oficial esteja disponível e o mercado possa ser liquidado sob as regras descritas nesta página.`
  }

  return `O mercado ${quoteLabel(event.title)} está programado para ser resolvido em ou por volta de ${closeDate}. Isso significa que as negociações permanecerão abertas e as probabilidades continuaros a mudar à medida que novas informações surgem até essa data. O momento exato da resolução depende de quando o resultado oficial estiver disponível, conforme detalhado na seção "Regras" nesta página.`
}

function buildTradersSayingAnswer(event: Event, commentsCount: number | null | undefined) {
  if (commentsCount != null && Number.isFinite(commentsCount) && commentsCount >= ACTIVE_COMMENTS_THRESHOLD) {
    return `O mercado ${quoteLabel(event.title)} tem uma comunidade ativa de ${formatCompactCount(commentsCount)} comentários onde os traders compartilham suas análises, debatem resultados e discutem os últimos acontecimentos. Role para baixo até a seção de comentários abaixo para ler o que outros participantes pensam. Você também pode filtrar por "Top Holders" para ver como os maiores traders do mercado estão posicionados, ou verificar a aba "Atividade" para um feed em tempo real das negociações.`
  }

  return `O mercado ${quoteLabel(event.title)} foi criado recentemente. Seja um dos primeiros a compartilhar sua análise postando um comentário abaixo, ou volte conforme o mercado cresce para ler o que outros traders pensam. Você também pode ver a aba "Atividade" para um feed em tempo real das negociações recentes.`
}

function buildWhatIsSiteAnswer(siteName: string, eventTitle: string) {
  return `O ${siteName} é uma plataforma de mercado de previsão onde você pode se manter informado e negociar em eventos do mundo real. Os traders compram e vendem ações em resultados de política, esportes, cripto, finanças, tecnologia e cultura, incluindo mercados como ${quoteLabel(eventTitle)}. Os preços refletem as probabilidades em tempo real da multidão, apoiadas por dinheiro real, oferecendo uma visão de mercado transparente sobre o que os participantes esperam que aconteça.`
}

export function buildEventFaqItems({
  event,
  siteName,
  commentsCount,
}: BuildEventFaqItemsOptions): EventFaqItem[] {
  const lowVolume = event.volume < LOW_VOLUME_THRESHOLD
  const binaryEvent = isBinaryEvent(event)
  const primarySelection = resolvePrimarySelection(event)

  return [
    {
      id: 'what-is',
      question: `O que é o mercado de previsão ${quoteLabel(event.title)}?`,
      answer: binaryEvent
        ? buildWhatIsBinaryAnswer(event, siteName)
        : buildWhatIsMultiAnswer(event, siteName),
    },
    {
      id: 'trading-activity',
      question: `Qual é o volume de negociação de ${quoteLabel(event.title)} no ${siteName}?`,
      answer: lowVolume
        ? buildLowVolumeAnswer(event)
        : buildStandardVolumeAnswer(event, siteName),
    },
    {
      id: 'how-to-trade',
      question: `Como eu negocio no ${quoteLabel(event.title)}?`,
      answer: binaryEvent
        ? buildTradeBinaryAnswer(event)
        : buildTradeMultiAnswer(event),
    },
    {
      id: 'current-odds',
      question: `Quais são as probabilidades atuais para ${quoteLabel(event.title)}?`,
      answer: binaryEvent
        ? buildCurrentOddsBinaryAnswer(event, siteName)
        : buildCurrentOddsMultiAnswer(event),
    },
    {
      id: 'resolution',
      question: `Como o mercado ${quoteLabel(event.title)} será resolvido?`,
      answer: buildResolutionAnswer(event),
    },
    {
      id: 'follow-without-trade',
      question: `Posso acompanhar o ${quoteLabel(event.title)} sem negociar?`,
      answer: buildFollowAnswer(event),
    },
    {
      id: 'odds-reliability',
      question: `Por que as probabilidades do ${siteName} para ${quoteLabel(event.title)} são confiáveis?`,
      answer: buildReliabilityAnswer(event, siteName),
    },
    {
      id: 'start-trading',
      question: `Como começo a negociar no ${quoteLabel(event.title)}?`,
      answer: buildStartTradingAnswer(event, siteName),
    },
    {
      id: 'price-meaning',
      question: binaryEvent
        ? `O que significa um preço de ${formatFaqCents(primarySelection.cents)} para "Sim"?`
        : `O que significa um preço de ${formatFaqCents(primarySelection.cents)} para ${quoteLabel(primarySelection.label)}?`,
      answer: binaryEvent
        ? buildPriceMeaningBinaryAnswer(event, siteName)
        : buildPriceMeaningMultiAnswer(event, siteName),
    },
    {
      id: 'close-time',
      question: `Quando o mercado ${quoteLabel(event.title)} fecha?`,
      answer: buildCloseAnswer(event),
    },
    {
      id: 'traders-saying',
      question: `O que os traders estão dizendo sobre ${quoteLabel(event.title)}?`,
      answer: buildTradersSayingAnswer(event, commentsCount),
    },
    {
      id: 'what-is-site',
      question: `O que é o ${siteName}?`,
      answer: buildWhatIsSiteAnswer(siteName, event.title),
    },
  ]
}
