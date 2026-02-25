import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Send, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  message: string;
  sender_type: string;
  sender_id: string | null;
  client_id: string | null;
  created_at: string;
  read: boolean;
}

interface Client {
  id: string;
  name: string;
}

export default function Chat() {
  const { t } = useLanguage();
  const { plan, shopId, canUseFeature } = useSubscription();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    init();
  }, []);

  useEffect(() => {
    if (!shopId) return;
    const loadClients = async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("shop_id", shopId)
        .order("name");
      if (data) setClients(data);
    };
    loadClients();
  }, [shopId]);

  const loadMessages = async () => {
    if (!shopId) return;
    let query = supabase
      .from("chat_messages")
      .select("*")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (selectedClient !== "all") {
      query = query.eq("client_id", selectedClient);
    }

    const { data } = await query;
    if (data) setMessages(data as ChatMessage[]);
  };

  useEffect(() => { loadMessages(); }, [shopId, selectedClient]);

  // Realtime subscription
  useEffect(() => {
    if (!shopId) return;
    const channel = supabase
      .channel('chat-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `shop_id=eq.${shopId}`,
      }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        if (selectedClient === "all" || newMsg.client_id === selectedClient) {
          setMessages(prev => [...prev, newMsg]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [shopId, selectedClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !shopId || !currentUserId) return;
    const { error } = await supabase.from("chat_messages").insert({
      shop_id: shopId,
      sender_id: currentUserId,
      sender_type: "staff",
      client_id: selectedClient !== "all" ? selectedClient : null,
      message: newMessage.trim(),
    });
    if (error) toast.error(error.message);
    else setNewMessage("");
  };

  if (!canUseFeature('chatbot')) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">{t('chat.title')}</h1>
        </div>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground mb-4">{t('chat.disabledPlan')}</p>
          <Link to="/billing">
            <Button>{t('nav.billing')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const getClientName = (clientId: string | null) => {
    if (!clientId) return t('chat.general');
    return clients.find(c => c.id === clientId)?.name || clientId.slice(0, 8);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="page-header flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="page-title">{t('chat.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('chat.subtitle')}</p>
        </div>
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-[200px]">
            <Users className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('chat.allConversations')}</SelectItem>
            {clients.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              <MessageCircle className="w-5 h-5 mr-2 opacity-50" />
              {t('chat.empty')}
            </div>
          ) : messages.map(msg => {
            const isMe = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                  isMe
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted text-foreground rounded-bl-md'
                }`}>
                  {!isMe && msg.client_id && (
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {getClientName(msg.client_id)}
                    </p>
                  )}
                  <p>{msg.message}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-border p-3 flex gap-2">
          <Input
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder={t('chat.placeholder')}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            className="flex-1"
          />
          <Button onClick={sendMessage} disabled={!newMessage.trim()} size="icon">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
