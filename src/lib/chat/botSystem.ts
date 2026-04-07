import { Event } from '@/types';

export interface BotMessage {
  id: string;
  user_nome: string;
  mensagem: string;
  previsoes: number;
  isBot: boolean;
  color: string;
}

const botNames = [
  'bet_master_99', 'vidente_pro', 'tropa_do_pix', 'lucas_tips', 'ana_vitoria', 
  'guilherme_trade', 'mercadofacil_fan', 'ze_da_call', 'rei_do_green', 'mila_bets',
  'df_apostas', 'crypto_king', 'be_invest', 'rafa_vision', 'gabriel_zero_red'
];

const genericTemplates = [
  'Essa é green certa! 🔥',
  'Alguém com a call aí?',
  'Tropa, o saque caiu aqui, bizarro de rápido! 🚀',
  'Vou de ALL IN nessa, fé no green.',
  'Bora lucrar rapaziada!',
  'Essa plataforma é a mais bugada (no bom sentido) que já vi kkkk',
  'Manda o pix pra fortalecer que eu passo a call!',
  'Hoje o laranjeira vai ser eu kkkk',
  'Como que saca o bônus?',
  'Fui red na anterior, mas nessa eu recupero!',
  'Olha o gráfico desse btc subindo!',
  'Só os fortes no mercado de hoje.',
  'Qual a boa pra agora?',
  'A banca já dobrou hoje kkk',
  'Alguém mais achando que o red tá vindo ali?',
  'Fé na visão tropa!',
  'Melhor site pra forrar, sem condições.',
  'Tô de olho na próxima call do vision.',
  'O saque via pix caiu em segundos, top.',
  'Bora que o btc não para de subir!',
  'Mais um green pra conta, venci!',
  'Alguém ajuda aqui, como vejo o histórico?',
  'Call monstra essa do {titulo}, pena que entrei com pouco kkk',
  'A zebra tá vindo forte, fiquem de olho!',
  'Essa plataforma é surreal, o saque cai na hora mesmo!',
  'Quem não entrar nessa tá maluco, tá dando sopa.',
  'Acabei de derreter o saldo na anterior, vamo ver se nessa recupera.',
  'O bônus de boas vindas ajuda demais nas primeiras calls.',
  'Alguém sabe se tem grupo de sinais?',
  'A odd do {categoria} tá desregulada, aproveitem!',
  'O mercado de {categoria} é o que eu mais gosto, sempre forro.',
  'Vambora tropa, hoje é dia de lucro!',
  'Fé em Deus e nas aposta kkkk 🙏',
  'O suporte daqui responde rápido demais, gostei.',
  'Caramba, quase que o green foge pelos dedos!',
  'Sextou com lucro no bolso, obrigado Mercado Fácil!',
  'Essa análise do bot tá certeira demais, slc.',
  'Vou botar o lucro da semana nessa, vamo que vamo!',
];

const marketTemplates = [
  'Tô achando que o mercado de "{titulo}" vai dar bom.',
  'Alguém mais indo no {opcao} em "{titulo}"?',
  'Esse de {categoria} tá com a odd muito alta, tá doido.',
  'Vou botar cinquentinha no "{titulo}".',
  'Cuidado com o de {categoria}, tá oscilando muito.',
  'O mercado "{titulo}" tá muito favorável pro {opcao}.',
  'Fechei minha posição em "{titulo}", lucro garantido!',
  'Alguém viu a odd do mercado de {categoria}? Tá insana!',
  'O {opcao} no mercado "{titulo}" é barbada.',
  'Vou arriscar no {opcao} em "{titulo}", quem vem?',
];

const colors = ['text-rose-400', 'text-amber-400', 'text-emerald-400', 'text-blue-400', 'text-purple-400'];

export function generateBotMessage(activeEvents: Event[]): BotMessage {
  const isMarketSpecific = Math.random() > 0.6;
  const templatePool = isMarketSpecific ? marketTemplates : genericTemplates;
  let message = templatePool[Math.floor(Math.random() * templatePool.length)];
  const name = botNames[Math.floor(Math.random() * botNames.length)];
  const previsoes = Math.floor(Math.random() * 500) + 1;
  const color = colors[Math.floor(Math.random() * colors.length)];

  if (activeEvents.length > 0) {
    const event = activeEvents[Math.floor(Math.random() * activeEvents.length)];
    const category = event.tags?.[0]?.name || 'Geral';
    const favoriteOutcome = 'Sim';
    
    // Always apply replacements to keep content dynamic
    message = message
      .replace(/{titulo}/g, event.title)
      .replace(/{categoria}/g, category)
      .replace(/{opcao}/g, favoriteOutcome);
  } else {
    // Fallback if no events loaded yet
    message = message
      .replace(/{titulo}/g, 'Mercado do dia')
      .replace(/{categoria}/g, 'Geral')
      .replace(/{opcao}/g, 'Nesta');
  }

  return {
    id: 'bot-' + Math.random().toString(36).substring(2, 11),
    user_nome: '@' + name,
    mensagem: message,
    previsoes,
    isBot: true,
    color
  };
}

