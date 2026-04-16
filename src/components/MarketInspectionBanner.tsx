import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Bell, ArrowRight } from "lucide-react";

/**
 * Persistent banner shown on top of the SaaS when the active partner shop
 * has pending Market inspection offers. Listens via Supabase Realtime and
 * plays a soft alert sound on new offers.
 *
 * Only renders for shops with is_carity_partner=true AND carity_active=true.
 */
export default function MarketInspectionBanner({ shopId, isPartner }: { shopId: string | null; isPartner: boolean }) {
  const [count, setCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const firstLoadRef = useRef(true);

  useEffect(() => {
    if (!shopId || !isPartner) {
      setCount(0);
      return;
    }

    const loadCount = async () => {
      const { count: c } = await supabase
        .from("carity_inspection_offers")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shopId)
        .eq("status", "pending");
      setCount(c || 0);
      firstLoadRef.current = false;
    };

    loadCount();

    const channel = supabase
      .channel(`banner-offers-${shopId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "carity_inspection_offers", filter: `shop_id=eq.${shopId}` },
        () => {
          loadCount();
          // Play soft alert sound (only after first load to avoid noise on mount)
          if (!firstLoadRef.current && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [shopId, isPartner]);

  if (!isPartner || count === 0) return null;

  return (
    <>
      {/* Tiny embedded notification chime (data URI WAV ~0.3s soft beep) */}
      <audio
        ref={audioRef}
        preload="auto"
        src="data:audio/wav;base64,UklGRpQGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YXAGAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIA="
      />
      <div className="bg-amber-500 text-slate-900 px-4 py-2 sticky top-0 z-[60] shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 text-sm font-medium">
          <div className="flex items-center gap-2 min-w-0">
            <Bell className="h-4 w-4 shrink-0 animate-pulse" />
            <span className="truncate">
              <strong>{count}</strong> {count === 1 ? "inspeção Market por responder" : "inspeções Market por responder"}
            </span>
          </div>
          <Link
            to="/market/inspections"
            className="flex items-center gap-1 bg-slate-900 text-amber-400 px-3 py-1 rounded-md font-semibold hover:bg-slate-800 shrink-0"
          >
            Ver agora <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </>
  );
}
