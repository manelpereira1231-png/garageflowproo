import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Send, MessageCircle, Euro, Check, X, Loader2, Lock, ShieldAlert } from "lucide-react";
import { filterMessage, type ViolationType } from "@/lib/chatSafetyFilter";

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

export default function CarityChat({ listingId, sellerId, listingPrice, listingLabel, currentUserId }: CarityChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [showOfferInput, setShowOfferInput] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingOffer, setPendingOffer] = useState<any>(null);
  const [acceptedOffer, setAcceptedOffer] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fugaAttempts, setFugaAttempts] = useState(0);
  const [fugaWarning, setFugaWarning] = useState<string | null>(null);
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

    // Check for pending/accepted offers
    const { data: offers } = await supabase
      .from("carity_offers" as any)
      .select("*")
      .eq("listing_id", listingId)
      .or(`buyer_id.eq.${currentUserId},seller_id.eq.${currentUserId}`)
      .order("created_at", { ascending: false });

    const offersList = (offers as any[]) || [];
    setPendingOffer(offersList.find((o: any) => o.status === "pending") || null);
    setAcceptedOffer(offersList.find((o: any) => o.status === "accepted") || null);

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
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "carity_offers",
        filter: `listing_id=eq.${listingId}`,
      }, () => { loadMessages(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, listingId, loadMessages]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUserId || sending) return;
    
    // Anti-fuga filter
    const filterResult = filterMessage(newMessage);
    if (!filterResult.safe) {
      setFugaAttempts(prev => prev + 1);
      setFugaWarning(filterResult.warningMessage);
      
      // Log the attempt
      try {
        await supabase.from("audit_logs").insert({
          action: "chat_fuga_attempt",
          entity_type: "carity_chat",
          entity_id: listingId,
          user_id: currentUserId,
          details: { violations: filterResult.violations, attempt_number: fugaAttempts + 1, message_preview: newMessage.substring(0, 50) + "..." },
        });
      } catch {}
      
      if (fugaAttempts >= 2) {
        toast.error("A sua conta pode ser suspensa por tentativas repetidas de fuga à plataforma.", { duration: 8000 });
      } else {
        toast.warning(filterResult.warningMessage, { duration: 6000 });
      }
      return;
    }
    
    setFugaWarning(null);
    setSending(true);
    try {
      const receiverId = isSeller ? messages.find(m => m.sender_id !== currentUserId)?.sender_id : sellerId;
      if (!receiverId) { toast.error("Não foi possível identificar o destinatário"); return; }
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

  const sendOffer = async () => {
    const amount = parseFloat(offerAmount);
    if (!amount || amount <= 0 || !currentUserId || sending) return;
    setSending(true);
    try {
      // Create offer
      await supabase.from("carity_offers" as any).insert({
        listing_id: listingId,
        buyer_id: currentUserId,
        seller_id: sellerId,
        amount,
        message: `Proposta de €${amount.toLocaleString()}`,
        status: "pending",
      });
      // Send as chat message too
      await supabase.from("carity_chat_messages" as any).insert({
        listing_id: listingId,
        sender_id: currentUserId,
        receiver_id: sellerId,
        message: `💰 Proposta: €${amount.toLocaleString()}`,
        message_type: "offer",
        offer_amount: amount,
      });
      setOfferAmount("");
      setShowOfferInput(false);
      toast.success("Proposta enviada!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar proposta");
    } finally {
      setSending(false);
    }
  };

  const respondToOffer = async (offerId: string, accept: boolean) => {
    setSending(true);
    try {
      await supabase.from("carity_offers" as any)
        .update({ status: accept ? "accepted" : "rejected", responded_at: new Date().toISOString() })
        .eq("id", offerId);

      const buyerId = pendingOffer?.buyer_id;
      if (buyerId) {
        await supabase.from("carity_chat_messages" as any).insert({
          listing_id: listingId,
          sender_id: currentUserId,
          receiver_id: buyerId,
          message: accept ? "✅ Proposta aceite! Pode proceder ao pagamento." : "❌ Proposta recusada.",
          message_type: accept ? "offer_accepted" : "offer_rejected",
          offer_amount: pendingOffer?.amount,
        });
      }
      toast.success(accept ? "Proposta aceite!" : "Proposta recusada.");
      loadMessages();
    } catch (err: any) {
      toast.error(err.message || "Erro");
    } finally {
      setSending(false);
    }
  };

  const handlePayment = async () => {
    if (!acceptedOffer || !currentUserId) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("carity-pay-inspection", {
        body: {
          action: "buy_car",
          listing_id: listingId,
          offer_id: acceptedOffer.id,
          amount: acceptedOffer.amount,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank", "noopener");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao iniciar pagamento");
    } finally {
      setSending(false);
    }
  };

  if (!currentUserId) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Lock className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium mb-2">Faça login para contactar o vendedor</p>
          <p className="text-sm text-muted-foreground mb-4">Toda a comunicação passa pela plataforma para sua segurança.</p>
          <Button onClick={() => window.location.href = `/market/auth?redirect=/market/car/${listingId}`}
            className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
            Entrar / Registar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-amber-500" />
          {isSeller ? "Mensagens dos interessados" : `Chat sobre ${listingLabel}`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Pending offer banner (seller side) */}
        {isSeller && pendingOffer && (
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="font-semibold text-sm mb-2">💰 Proposta recebida: €{pendingOffer.amount?.toLocaleString()}</p>
            <div className="flex gap-2">
              <Button size="sm" className="bg-green-600 hover:bg-green-500 text-white" onClick={() => respondToOffer(pendingOffer.id, true)} disabled={sending}>
                <Check className="h-3.5 w-3.5 mr-1" /> Aceitar
              </Button>
              <Button size="sm" variant="outline" onClick={() => respondToOffer(pendingOffer.id, false)} disabled={sending}>
                <X className="h-3.5 w-3.5 mr-1" /> Recusar
              </Button>
            </div>
          </div>
        )}

        {/* Accepted offer banner (buyer side) */}
        {isBuyer && acceptedOffer && acceptedOffer.status === "accepted" && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="font-semibold text-sm mb-2">✅ Proposta aceite: €{acceptedOffer.amount?.toLocaleString()}</p>
            <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold" onClick={handlePayment} disabled={sending}>
              {sending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Euro className="h-3.5 w-3.5 mr-1" />}
              Pagar agora
            </Button>
          </div>
        )}

        {/* Messages list */}
        <div ref={scrollRef} className="max-h-64 overflow-y-auto space-y-2 p-2">
          {loading ? (
            <div className="text-center py-6 text-muted-foreground text-sm">A carregar...</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              {isBuyer ? "Envie uma mensagem ao vendedor" : "Aguarde mensagens dos interessados"}
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                  msg.message_type === "offer" ? 'bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700' :
                  msg.message_type === "offer_accepted" ? 'bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-700' :
                  msg.message_type === "offer_rejected" ? 'bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-700' :
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

        {/* Input area */}
        {isBuyer && (
          <div className="space-y-2">
            {showOfferInput ? (
              <div className="flex gap-2">
                <Input type="number" placeholder="Valor da proposta (€)" value={offerAmount}
                  onChange={e => setOfferAmount(e.target.value)}
                  className="flex-1" />
                <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-900" onClick={sendOffer} disabled={sending || !offerAmount}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowOfferInput(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input placeholder="Escreva uma mensagem..." value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendMessage()}
                  className="flex-1" />
                <Button size="icon" className="bg-amber-500 hover:bg-amber-400 text-slate-900" onClick={sendMessage} disabled={sending || !newMessage.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
                {!pendingOffer && !acceptedOffer && (
                  <Button size="icon" variant="outline" onClick={() => setShowOfferInput(true)} title="Fazer proposta">
                    <Euro className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {isSeller && (
          <div className="flex gap-2">
            <Input placeholder="Responder..." value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              className="flex-1" />
            <Button size="icon" className="bg-amber-500 hover:bg-amber-400 text-slate-900" onClick={sendMessage} disabled={sending || !newMessage.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
          <Lock className="h-3 w-3" /> Comunicação protegida pela plataforma GarageFlow Market
        </p>
      </CardContent>
    </Card>
  );
}
