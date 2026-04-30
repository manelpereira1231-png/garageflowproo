import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Car, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import MarketLayout from "@/components/MarketLayout";
import CarityChat from "@/components/CarityChat";
import { useMarketT } from "@/i18n/marketTranslations";

interface Conversation {
  listingId: string;
  otherUserId: string;
  listingTitle: string;
  listingPhoto: string | null;
  lastMessage: string;
  lastAt: string;
  unread: number;
}

export default function MarketMessages() {
  const t = useMarketT();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/market/auth"); return; }
    setUserId(user.id);

    // Get all messages involving this user
    const { data: messages } = await supabase
      .from("carity_chat_messages")
      .select("*")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (!messages || messages.length === 0) {
      setLoading(false);
      return;
    }

    // Group by listing_id + other_user_id
    const convoMap = new Map<string, any>();
    messages.forEach((msg: any) => {
      const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      const key = `${msg.listing_id}__${otherId}`;
      if (!convoMap.has(key)) {
        convoMap.set(key, {
          listingId: msg.listing_id,
          otherUserId: otherId,
          lastMessage: msg.message,
          lastAt: msg.created_at,
          unread: (!msg.read && msg.receiver_id === user.id) ? 1 : 0,
        });
      } else {
        const c = convoMap.get(key);
        if (!msg.read && msg.receiver_id === user.id) c.unread++;
      }
    });

    // Fetch listing info
    const listingIds = [...new Set([...convoMap.values()].map(c => c.listingId))];
    const { data: listings } = await supabase
      .from("carity_listings")
      .select("id, make, model, year, photos")
      .in("id", listingIds);

    const listingsMap: Record<string, any> = {};
    (listings || []).forEach((l: any) => { listingsMap[l.id] = l; });

    const result: Conversation[] = [...convoMap.values()].map(c => {
      const listing = listingsMap[c.listingId];
      const photos = listing?.photos ? (Array.isArray(listing.photos) ? listing.photos : []) : [];
      return {
        ...c,
        listingTitle: listing ? `${listing.make} ${listing.model} (${listing.year})` : t("msg.vehicle"),
        listingPhoto: photos[0] || null,
      };
    });

    result.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
    setConversations(result);
    setLoading(false);
  };

  if (loading) {
    return (
      <MarketLayout>
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </MarketLayout>
    );
  }

  return (
    <MarketLayout>
      <h1 className="text-2xl font-bold mb-6">{t("msg.title")}</h1>

      {activeConvo && userId ? (
        <div>
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => setActiveConvo(null)}>
            {t("msg.back")}
          </Button>
          <Card>
            <CardContent className="p-0">
              <div className="p-3 border-b flex items-center gap-3">
                {activeConvo.listingPhoto && (
                  <img src={activeConvo.listingPhoto} alt="" className="w-10 h-8 rounded object-cover" />
                )}
                <p className="font-medium text-sm">{activeConvo.listingTitle}</p>
              </div>
              <CarityChat
                listingId={activeConvo.listingId}
                sellerId={activeConvo.otherUserId}
                currentUserId={userId}
                listingPrice={0}
                listingLabel={activeConvo.listingTitle}
              />
            </CardContent>
          </Card>
        </div>
      ) : conversations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold mb-2">{t("msg.empty.title")}</h3>
            <p className="text-muted-foreground">{t("msg.empty.desc")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {conversations.map(convo => (
            <Card
              key={`${convo.listingId}__${convo.otherUserId}`}
              className="cursor-pointer hover:bg-muted/50 transition"
              onClick={() => setActiveConvo(convo)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-12 h-9 rounded bg-muted flex-shrink-0 overflow-hidden">
                  {convo.listingPhoto ? (
                    <img src={convo.listingPhoto} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full"><Car className="h-4 w-4 text-muted-foreground/30" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{convo.listingTitle}</p>
                  <p className="text-xs text-muted-foreground truncate">{convo.lastMessage}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-muted-foreground">
                    {new Date(convo.lastAt).toLocaleDateString("pt-PT")}
                  </span>
                  {convo.unread > 0 && (
                    <Badge className="bg-amber-500 text-slate-900 text-xs">{convo.unread}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </MarketLayout>
  );
}
