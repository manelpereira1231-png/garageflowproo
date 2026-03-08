import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Users, Mail, UsersRound, Search, Circle } from "lucide-react";
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
  email: string;
}

export default function Chat() {
  const { t } = useLanguage();
  const { plan, shopId, canUseFeature, loading: subLoading } = useSubscription();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [shopName, setShopName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
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
    const load = async () => {
      const [clientsRes, shopRes] = await Promise.all([
        supabase.from("clients").select("id, name, email").eq("shop_id", shopId).is("deleted_at", null).order("name"),
        supabase.from("shops").select("name").eq("id", shopId).maybeSingle(),
      ]);
      if (clientsRes.data) setClients(clientsRes.data);
      if (shopRes.data) setShopName(shopRes.data.name || "");
    };
    load();
  }, [shopId]);

  // Load unread counts
  useEffect(() => {
    if (!shopId) return;
    const loadUnread = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("client_id")
        .eq("shop_id", shopId)
        .eq("read", false)
        .neq("sender_type", "staff");
      if (data) {
        const counts: Record<string, number> = {};
        data.forEach(m => {
          const key = m.client_id || "all";
          counts[key] = (counts[key] || 0) + 1;
        });
        setUnreadCounts(counts);
      }
    };
    loadUnread();
  }, [shopId, messages]);

  const loadMessages = async () => {
    if (!shopId) return;
    let query = supabase
      .from("chat_messages")
      .select("*")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: true })
      .limit(200);

    if (selectedClient !== "all") {
      query = query.eq("client_id", selectedClient);
    }

    const { data } = await query;
    if (data) setMessages(data as ChatMessage[]);

    // Mark as read
    if (selectedClient !== "all") {
      await supabase.from("chat_messages")
        .update({ read: true } as any)
        .eq("shop_id", shopId)
        .eq("client_id", selectedClient)
        .eq("read", false);
    }
  };

  useEffect(() => { loadMessages(); }, [shopId, selectedClient]);

  // Realtime
  useEffect(() => {
    if (!shopId) return;
    const channel = supabase
      .channel('chat-messages')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
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
    setSending(true);

    const isClientMessage = selectedClient !== "all";
    const client = isClientMessage ? clients.find(c => c.id === selectedClient) : null;

    const { error } = await supabase.from("chat_messages").insert({
      shop_id: shopId, sender_id: currentUserId, sender_type: "staff",
      client_id: isClientMessage ? selectedClient : null, message: newMessage.trim(),
    });

    if (error) { toast.error(error.message); setSending(false); return; }

    // Email notification for client messages
    if (isClientMessage && client?.email) {
      try {
        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #1a1a2e; padding: 20px 24px; border-radius: 12px 12px 0 0;">
              <h2 style="color: #ffffff; margin: 0; font-size: 18px;">💬 ${t('chat.emailSubject')}</h2>
              <p style="color: #a0a0b0; margin: 4px 0 0; font-size: 13px;">${shopName}</p>
            </div>
            <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
              <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
                ${t('chat.emailGreeting').replace('{name}', client.name)},
              </p>
              <div style="background: #f3f4f6; border-left: 4px solid #6366f1; padding: 16px; border-radius: 0 8px 8px 0; margin: 0 0 16px;">
                <p style="color: #1f2937; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${newMessage.trim()}</p>
              </div>
              <p style="color: #6b7280; font-size: 13px; margin: 0;">${t('chat.emailFooter')}</p>
            </div>
            <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 16px;">${shopName} — GarageFlow</p>
          </div>`;
        await supabase.functions.invoke("send-email", {
          body: { to: client.email, subject: `💬 ${t('chat.emailSubject')} — ${shopName}`, html: emailHtml },
        });
        await supabase.from("email_logs").insert({
          shop_id: shopId, to_email: client.email,
          subject: `${t('chat.emailSubject')} — ${shopName}`, entity_type: "chat", status: "sent",
        });
      } catch (e) { console.error("Email failed:", e); }
    }

    setNewMessage("");
    setSending(false);
  };

  if (subLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!canUseFeature('chatbot')) {
    return (
      <div>
        <div className="page-header"><h1 className="page-title">{t('chat.title')}</h1></div>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground mb-4">{t('chat.disabledPlan')}</p>
          <Link to="/billing"><Button>{t('nav.billing')}</Button></Link>
        </div>
      </div>
    );
  }

  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const selectedClientObj = clients.find(c => c.id === selectedClient);
  const isTeamChat = selectedClient === "all";
  const totalUnread = Object.values(unreadCounts).reduce((s, c) => s + c, 0);

  // Get last message per client for sidebar preview
  const getLastMessage = (clientId: string | null): ChatMessage | undefined => {
    const filtered = messages.filter(m => clientId ? m.client_id === clientId : !m.client_id);
    return filtered[filtered.length - 1];
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            {t('chat.title')}
            {totalUnread > 0 && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{totalUnread}</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">{t('chat.subtitle')}</p>
        </div>
      </div>

      <div className="flex-1 flex border border-border rounded-xl overflow-hidden bg-card">
        {/* Sidebar - Client list */}
        <div className="w-[260px] border-r border-border flex flex-col shrink-0 hidden md:flex">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('chat.searchClients')}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {/* Team chat */}
            <button
              onClick={() => setSelectedClient("all")}
              className={`w-full text-left px-3 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors ${isTeamChat ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <UsersRound className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t('chat.teamChat')}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{t('chat.teamOnly')}</p>
                </div>
              </div>
            </button>

            {/* Client conversations */}
            {filteredClients.map(c => {
              const unread = unreadCounts[c.id] || 0;
              const isActive = selectedClient === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedClient(c.id)}
                  className={`w-full text-left px-3 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors ${isActive ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        {unread > 0 && <Badge variant="destructive" className="text-[10px] px-1.5 py-0 ml-1">{unread}</Badge>}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        {c.email && <Mail className="w-3 h-3" />}
                        <span className="truncate">{c.email || t('chat.noEmail')}</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </ScrollArea>
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col">
          {/* Chat header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isTeamChat ? (
                <>
                  <UsersRound className="w-5 h-5 text-primary" />
                  <span className="font-medium">{t('chat.teamChat')}</span>
                  <Badge variant="outline" className="text-[10px]">{t('chat.teamOnly')}</Badge>
                </>
              ) : selectedClientObj ? (
                <>
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {selectedClientObj.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium">{selectedClientObj.name}</span>
                  {selectedClientObj.email && (
                    <Badge variant="outline" className="gap-1 text-[10px]"><Mail className="w-3 h-3" />{t('chat.sendsEmail')}</Badge>
                  )}
                </>
              ) : null}
            </div>
            {/* Mobile client selector */}
            <div className="md:hidden">
              <select
                value={selectedClient}
                onChange={e => setSelectedClient(e.target.value)}
                className="text-sm bg-muted rounded px-2 py-1 border border-border"
              >
                <option value="all">{t('chat.teamChat')}</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Messages */}
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
                    isMe ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted text-foreground rounded-bl-md'
                  }`}>
                    {!isMe && msg.client_id && (
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        {clients.find(c => c.id === msg.client_id)?.name || msg.client_id?.slice(0, 8)}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                    <p className={`text-[10px] mt-1 ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isMe && msg.client_id && clients.find(c => c.id === msg.client_id)?.email && <span className="ml-1">📧</span>}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-3 flex gap-2">
            <Input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder={
                isTeamChat ? t('chat.placeholderTeam')
                  : selectedClientObj?.email ? t('chat.placeholderClient').replace('{name}', selectedClientObj.name)
                  : t('chat.placeholder')
              }
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && !sending && sendMessage()}
              className="flex-1"
              disabled={sending}
            />
            <Button onClick={sendMessage} disabled={!newMessage.trim() || sending} size="icon">
              {sending ? (
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : selectedClient !== "all" && selectedClientObj?.email ? (
                <Mail className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
