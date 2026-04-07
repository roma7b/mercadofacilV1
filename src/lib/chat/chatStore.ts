import { generateBotMessage } from './botSystem';
import { Event } from '@/types';

// Global buffer for bot messages to survive component unmounting
let botMessageHistory: any[] = [];
let lastBotMessageContent = '';
const MAX_HISTORY = 50;

type Listener = (messages: any[]) => void;
let listeners: Listener[] = [];

let timerId: any = null;
let currentEvents: Event[] = [];
let isInitialized = false;

export const chatStore = {
  getHistory: () => botMessageHistory,

  addMessage: (msg: any) => {
    // Prevent exactly identical messages from appearing twice in a row
    if (msg.mensagem === lastBotMessageContent) return;
    lastBotMessageContent = msg.mensagem;

    botMessageHistory = [...botMessageHistory, msg].slice(-MAX_HISTORY);
    listeners.forEach(l => l(botMessageHistory));
  },

  subscribe: (listener: Listener) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  },

  // Helper to trigger a bot message globally
  triggerBot: () => {
    const botMsg = generateBotMessage(currentEvents);
    const newMsg = {
      id: botMsg.id,
      user_id: 'bot',
      mensagem: botMsg.mensagem,
      created_at: new Date().toISOString(),
      users: { username: botMsg.user_nome }, // Adjust to username in new schema
      isBot: true,
      previsoes: botMsg.previsoes,
      color: botMsg.color
    };
    chatStore.addMessage(newMsg);
  },

  // Start the global loop once
  startBotLoop: (events: Event[]) => {
    if (events && events.length > 0) {
      currentEvents = events;
    }
    
    if (timerId) return;

    const run = () => {
      // De 1.5s a 5s para ser bem movimentado como um chat ao vivo real
      const delay = Math.floor(Math.random() * 3500) + 1500; 
      timerId = setTimeout(() => {
        // 80% de chance de bot falar para manter o chat "vivo"
        if (Math.random() > 0.2) { 
          chatStore.triggerBot();
          // Pequena chance de "rajada" de mensagens
          if (Math.random() > 0.85) {
            setTimeout(() => chatStore.triggerBot(), 800);
          }
        }
        run();
      }, delay);
    };
    run();
  },

  init: () => {
    if (isInitialized) return;
    isInitialized = true;
    // Pre-populate with some initial activity
    for (let i = 0; i < 5; i++) {
      chatStore.triggerBot();
    }
    // Start loop immediately even with empty events to avoid 'parado' state
    chatStore.startBotLoop([]);
  },

  stopBotLoop: () => {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  }
};

if (typeof window !== 'undefined') {
  chatStore.init();
}

