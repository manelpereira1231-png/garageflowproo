import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, Users, Mail, UsersRound } from "lucide-react";
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
  const { plan, shopId, canUseFeature } = useSubscription();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [shopName, setShopName] = useState("");
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
        supabase.from("clients").select("id, name, email").eq("shop_id", shopId).order("name"),
        supabase.from("shops").select("name").eq("id", shopId).maybeSingle(),
      ]);
      if (clientsRes.data) setClients(clientsRes.data);
      if (shopRes.data) setShopName(shopRes.data.name || "");
    };
    load();
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
    setSending(true);

    const isClientMessage = selectedClient !== "all";
    const client = isClientMessage ? clients.find(c => c.id === selectedClient) : null;

    // Insert chat message
    const { error } = await supabase.from("chat_messages").insert({
      shop_id: shopId,
      sender_id: currentUserId,
      sender_type: "staff",
      client_id: isClientMessage ? selectedClient : null,
      message: newMessage.trim(),
    });

    if (error) {
      toast.error(error.message);
      setSending(false);
      return;
    }

    // If sending to a client with email, also send email notification
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
              <p style="color: #6b7280; font-size: 13px; margin: 0;">
                ${t('chat.emailFooter')}
              </p>
            </div>
            <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 16px;">
              ${shopName} — GarageFlow
            </p>
          </div>
        `;

        await supabase.functions.invoke("send-email", {
          body: {
            to: client.email,
            subject: `💬 ${t('chat.emailSubject')} — ${shopName}`,
            html: emailHtml,
          },
        });

        // Log the email
        await supabase.from("email_logs").insert({
          shop_id: shopId,
          to_email: client.email,
          subject: `${t('chat.emailSubject')} — ${shopName}`,
          entity_type: "chat",
          status: "sent",
        });
      } catch (emailError: any) {
        console.error("Email notification failed:", emailError);
        // Don't block the chat message if email fails
      }
    }

    setNewMessage("");
    setSending(false);
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

  const selectedClientObj = clients.find(c => c.id === selectedClient);
  const isTeamChat = selectedClient === "all";

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="page-header flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="page-title">{t('chat.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('chat.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Indicator: email or in-app */}
          {!isTeamChat && selectedClientObj && (
            <Badge variant="outline" className="gap-1.5 text-xs py-1">
              {selectedClientObj.email ? (
                <>
                  <Mail className="w-3 h-3" />
                  {t('chat.sendsEmail')}
                </>
              ) : (
                <>
                  <MessageCircle className="w-3 h-3" />
                  {t('chat.noEmail')}
                </>
              )}
            </Badge>
          )}
          {isTeamChat && (
            <Badge variant="outline" className="gap-1.5 text-xs py-1">
              <UsersRound className="w-3 h-3" />
              {t('chat.teamOnly')}
            </Badge>
          )}
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-[200px]">
              <Users className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('chat.allConversations')}</SelectItem>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex items-center gap-2">
                    <span>{c.name}</span>
                    {c.email && <Mail className="w-3 h-3 text-muted-foreground" />}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
                  <p className="whitespace-pre-wrap">{msg.message}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isMe && msg.client_id && (
                      <span className="ml-2">
                        {clients.find(c => c.id === msg.client_id)?.email ? '📧' : ''}
                      </span>
                    )}
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
            placeholder={
              isTeamChat 
                ? t('chat.placeholderTeam') 
                : selectedClientObj?.email 
                  ? t('chat.placeholderClient').replace('{name}', selectedClientObj.name)
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
  );
}
