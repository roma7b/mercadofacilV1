'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Loader2, Send } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { supabase } from '@/lib/supabase-client';
import { chatStore } from '@/lib/chat/chatStore';
import { Event } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ChatMessage {
  id: string;
  user_id: string;
  mensagem: string;
  created_at: string;
  users?: { username: string | null };
  isBot?: boolean;
  previsoes?: number;
  color?: string;
  bot_name?: string;
}

interface LiveChatProps { 
  events: Event[];
  className?: string;
}

export function LiveChat({ events, className }: LiveChatProps) {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [onlineCount, setOnlineCount] = useState(654); 
  const scrollRef = useRef<HTMLDivElement>(null);

  // Online Count Fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineCount(prev => {
        const change = Math.floor(Math.random() * 7) - 3;
        return Math.max(600, Math.min(1000, prev + change));
      });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let subscription: any = null;
    
    const fetchMessages = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*, users(username)')
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (error) throw error;
        
        const formattedMsgs = data ? data.reverse().map((m: any) => ({
          ...m,
          isBot: m.is_bot,
          users: m.is_bot ? { username: m.bot_name } : m.users
        })) : [];
        
        setMessages(formattedMsgs);
      } catch (e) {
        console.error('Erro ao buscar chat:', e);
      } finally {
        setLoading(false);
      }
    };

    const subscribeToNewMessages = () => {
      if (!supabase) return;

      subscription = supabase
        .channel('public:chat_messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' },
          async (payload: any) => {
             let username = 'Anônimo';
             if (payload.new.is_bot) {
               username = payload.new.bot_name;
             } else {
               const { data: userData } = await supabase.from('users').select('username').eq('id', payload.new.user_id).single();
               username = (userData as any)?.username || 'Usuário';
             }

             const newMsg: ChatMessage = {
               ...payload.new as ChatMessage,
               isBot: payload.new.is_bot,
               users: { username }
             };
             setMessages(prev => [...prev, newMsg]);
          }
        ).subscribe();
    };

    const fetchEventsForContext = async () => {
      try {
        const res = await fetch('/api/events?tag=trending&pageSize=10');
        const data = await res.json();
        if (data && data.events) {
          chatStore.startBotLoop(data.events);
        }
      } catch (err) {
        console.warn('Could not fetch events for chat context', err);
      }
    };

    fetchMessages();
    subscribeToNewMessages();
    fetchEventsForContext();

    // Init store first if browser
    if (typeof window !== 'undefined') {
      chatStore.init();
      
      // Sync with bot history from local store
      setMessages(prev => {
        const bots = chatStore.getHistory();
        const botIds = new Set(prev.filter(m => m.isBot).map(m => m.id));
        const newBots = bots.filter(b => !botIds.has(b.id));
        return [...prev, ...newBots].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });

      const unsubscribe = chatStore.subscribe((allBots) => {
          setMessages(prev => {
            const nonBots = prev.filter(m => !m.isBot);
            return [...nonBots, ...allBots].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          });
      });

      return () => { 
        if (subscription && supabase) supabase.removeChannel(subscription); 
        unsubscribe();
      };
    }
  }, []);

  // Bot Simulation Loop
  useEffect(() => {
    if (events.length > 0) {
      chatStore.startBotLoop(events);
    }
  }, [events]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user || !supabase || sending) return;
    
    setSending(true);
    const msg = input.trim();
    setInput('');
    
    try {
      const { error } = await supabase.from('chat_messages').insert({ 
        user_id: user.id, 
        mensagem: msg,
        is_bot: false 
      });
      if (error) {
        console.error('Error sending message:', error);
        setInput(msg); // return text if error
      }
    } catch (err) {
      console.error('Catch error sending message:', err);
      setInput(msg);
    } finally {
      setSending(false);
    }
  };

  const getRandomColor = (id: string) => {
    if (!id) return 'text-amber-400';
    const colors = ['text-rose-400', 'text-amber-400', 'text-emerald-400', 'text-blue-400', 'text-purple-400'];
    // Simple hash from string id
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index] || colors[0];
  };

  return (
    <div className={cn("flex flex-col h-full bg-card/50 backdrop-blur-sm border-l border-border transition-all duration-300", className)}>
      <div className="px-5 py-4 flex items-center justify-between border-b border-border bg-card/80">
        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
          Chat ao Vivo
        </h3>
        <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1.5 tabular-nums">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {onlineCount} online
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground/50">
             <Loader2 size={24} className="animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs text-center px-6 italic">
            Não há mensagens no chat ainda. Seja o primeiro a participar!
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="text-xs leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300">
              <span className={cn(
                "font-bold tracking-tight mr-1.5",
                m.isBot ? m.color : getRandomColor(m.user_id)
              )}>
                {m.users?.username || 'Usuário'}{m.user_id === user?.id && ' (você)'}:
              </span>
              <span className="text-foreground/90 font-medium break-words">
                {m.mensagem}
                {m.isBot && m.previsoes && (
                  <span className="text-[9px] text-muted-foreground font-bold ml-1.5 opacity-60">
                    — {m.previsoes} previsões
                  </span>
                )}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="p-4 bg-card/80 border-t border-border">
        {!user ? (
          <div className="w-full bg-secondary/50 border border-border rounded-xl py-5 px-4 text-center">
            <p className="text-[11px] text-muted-foreground mb-3 font-medium">Faça login para participar do chat</p>
            <Button 
                variant="default" 
                size="sm" 
                className="w-full font-bold text-[10px] uppercase tracking-widest"
                onClick={() => window.location.href = '/login'}
            >
              Entrar ou Criar Conta
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="relative flex flex-col gap-2">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enviar mensagem..."
                maxLength={200}
                className="w-full bg-background/50 border border-border focus:border-primary/50 focus:outline-none rounded-full py-3.5 pl-5 pr-12 text-xs font-medium text-foreground transition-all placeholder:text-muted-foreground/60 shadow-inner"
              />
              <button 
                type="submit" 
                disabled={!input.trim() || sending} 
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-primary disabled:opacity-50 transition-colors"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="-ml-0.5" />}
              </button>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 text-center">
                Seja respeitoso. O Chat é moderado.
            </span>
          </form>
        )}
      </div>
    </div>
  );
}
