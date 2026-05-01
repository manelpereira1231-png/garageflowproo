import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Send, MessageCircle, Loader2, Lock, ShieldAlert, Shield } from "lucide-react";
import { filterMessage, getViolationSeverity, type ViolationType } from "@/lib/chatSafetyFilter";
import { useMarketT } from "@/i18n/marketTranslations";

interface CarityChatProps {
  listingId: string;
  sellerId: string;
  listingPrice: number;
  listingLabel: string;
  currentUserId: string | null;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  message_type: string;
  offer_amount: number | null;
  created_at: string;
  read: boolean;
}

/**
 * CarityChat — Communication-only chat, activated ONLY after escrow payment.
 * No offers, no payment buttons. All transactions go through escrow.
 */
export default function CarityChat({ listingId, sellerId, listingPrice, listingLabel, currentUserId }: CarityChatProps) {
  const t = useMarketT();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fugaAttempts, setFugaAttempts] = useState(0);
  const [fugaWarning, setFugaWarning] = useState<string | null>(null);
  const [restricted, setRestricted] = useState(false);
  const isSeller = currentUserId === sellerId;
  const isBuyer = currentUserId && currentUserId !== sellerId;

  const loadMessages = useCallback(async () => {
    if (!currentUserId || !listingId) return;

    const { data } = await supabase
      .from("carity_chat_messages" as any)
      .select("*")
      .eq("listing_id", listingId)
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      .order("created_at", { ascending: true });

    setMessages((data as any[]) || []);
    setLoading(false);
  }, [currentUserId, listingId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Realtime
  useEffect(() => {
    if (!currentUserId || !listingId) return;
    const channel = supabase
      .channel(`chat-${listingId}-${currentUserId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "carity_chat_messages",
        filter: `listing_id=eq.${listingId}`,
      }, (payload: any) => {
        const msg = payload.new as ChatMessage;
        if (msg.sender_id === currentUserId || msg.receiver_id === currentUserId) {
          setMessages(prev => [...prev, msg]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, listingId]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Check if user is restricted from previous violations
  useEffect(() => {
    if (!currentUserId) return;
    supabase.from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "chat_fuga_attempt")
      .eq("user_id", currentUserId)
      .then(({ count }) => {
        const total = count || 0;
        setFugaAttempts(total);
        if (getViolationSeverity(total) === "suspension") {
          setRestricted(true);
        }
      });
  }, [currentUserId]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUserId || sending || restricted) return;
    
    // Anti-fuga filter
    const filterResult = filterMessage(newMessage);
    if (!filterResult.safe) {
      const newCount = fugaAttempts + 1;
      setFugaAttempts(newCount);
      setFugaWarning(filterResult.warningMessage);
      
      // Log the attempt
      try {
        await supabase.from("audit_logs").insert({
          action: "chat_fuga_attempt",
          entity_type: "carity_chat",
          entity_id: listingId,
          user_id: currentUserId,
          details: { violations: filterResult.violations, attempt_number: newCount, message_preview: newMessage.substring(0, 50) + "..." },
        });
      } catch {}

      const severity = getViolationSeverity(newCount);
      if (severity === "suspension") {
        setRestricted(true);
        toast.error(t("chat.suspended"), { duration: 10000 });
      } else if (severity === "restriction") {
        toast.error("⚠️ Último aviso — a próxima tentativa suspenderá o seu chat.", { duration: 8000 });
      } else {
        toast.warning(filterResult.warningMessage, { duration: 6000 });
      }
      return;
    }
    
    setFugaWarning(null);
    setSending(true);
    try {
      const receiverId = isSeller ? messages.find(m => m.sender_id !== currentUserId)?.sender_id : sellerId;
      if (!receiverId) { toast.error(t("chat.noReceiver")); setSending(false); return; }
      await supabase.from("carity_chat_messages" as any).insert({
        listing_id: listingId,
        sender_id: currentUserId,
        receiver_id: receiverId,
        message: newMessage.trim(),
        message_type: "text",
      });
      setNewMessage("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  if (!currentUserId) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Lock className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium mb-2">Faça login para continuar</p>
          <p className="text-sm text-muted-foreground">Toda a comunicação passa pela plataforma para sua segurança.</p>
        </CardContent>
      </Card>
    );
  }

  if (restricted) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <ShieldAlert className="h-8 w-8 mx-auto mb-3 text-destructive" />
          <p className="font-medium mb-2 text-destructive">Chat suspenso</p>
          <p className="text-sm text-muted-foreground">O seu acesso ao chat foi restrito por violações repetidas dos termos de utilização.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-amber-500" />
          {isSeller ? t("chat.title.seller") : t("chat.title.buyer", { label: listingLabel })}
        </CardTitle>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1">
          <Shield className="h-3 w-3 text-green-500" />
          {t("chat.protected")}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Anti-fuga warning */}
        {fugaWarning && (
          <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/30 flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-destructive font-medium">{fugaWarning}</p>
              {fugaAttempts >= 2 && (
                <p className="text-[10px] text-destructive/80 mt-1">
                  ⚠️ {t("chat.warn", { n: fugaAttempts })}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Messages list */}
        <div ref={scrollRef} className="max-h-72 overflow-y-auto space-y-2 p-2">
          {loading ? (
            <div className="text-center py-6 text-muted-foreground text-sm">{t("chat.loading")}</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              {isBuyer
                ? t("chat.empty.buyer")
                : t("chat.empty.seller")}
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                  msg.sender_id === currentUserId ? 'bg-amber-500 text-slate-900' : 'bg-muted'
                }`}>
                  <p>{msg.message}</p>
                  <p className="text-[10px] mt-1 opacity-60">
                    {new Date(msg.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <Separator />

        {/* Input area — same for buyer and seller, communication only */}
        <div className="flex gap-2">
          <Input
            placeholder={isSeller ? t("chat.placeholder.seller") : t("chat.placeholder.buyer")}
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            className="flex-1"
          />
          <Button
            size="icon"
            className="bg-amber-500 hover:bg-amber-400 text-slate-900"
            onClick={sendMessage}
            disabled={sending || !newMessage.trim()}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
          <Lock className="h-3 w-3" /> Comunicação monitorizada • Partilha de contactos bloqueada
        </p>
      </CardContent>
    </Card>
  );
}
