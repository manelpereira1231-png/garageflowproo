import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Info, AlertTriangle, CheckCircle2, AlertCircle, Sparkles, ExternalLink } from "lucide-react";
import { useLocation } from "react-router-dom";

interface Broadcast {
  id: string;
  title: string;
  message: string;
  level: "info" | "warning" | "success" | "error" | "promo";
  audience: "all" | "erp" | "market" | "super_admin";
  link_url: string | null;
  link_label: string | null;
}

const LEVEL_STYLES: Record<Broadcast["level"], { bg: string; icon: any; text: string }> = {
  info: { bg: "bg-primary/10 border-primary/30 text-foreground", icon: Info, text: "text-primary" },
  warning: { bg: "bg-warning/10 border-warning/30 text-foreground", icon: AlertTriangle, text: "text-warning" },
  success: { bg: "bg-success/10 border-success/30 text-foreground", icon: CheckCircle2, text: "text-success" },
  error: { bg: "bg-destructive/10 border-destructive/30 text-foreground", icon: AlertCircle, text: "text-destructive" },
  promo: { bg: "bg-gradient-to-r from-primary/15 via-primary/10 to-amber-500/10 border-primary/40 text-foreground", icon: Sparkles, text: "text-primary" },
};

export default function SystemBroadcastBanner() {
  const [items, setItems] = useState<Broadcast[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const location = useLocation();

  const context: "erp" | "market" = location.pathname.startsWith("/market") || location.pathname.startsWith("/carity") ? "market" : "erp";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        // Local dismissals fallback (anonymous)
        const localDismissed = new Set<string>(
          JSON.parse(localStorage.getItem("gf_dismissed_broadcasts") || "[]"),
        );

        const { data } = await supabase
          .from("system_broadcasts")
          .select("id, title, message, level, audience, link_url, link_label, starts_at, ends_at, active")
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(20);

        const now = Date.now();
        const filtered = (data || []).filter((b: any) => {
          if (b.starts_at && new Date(b.starts_at).getTime() > now) return false;
          if (b.ends_at && new Date(b.ends_at).getTime() < now) return false;
          if (b.audience === "super_admin") return false; // never auto-show
          if (b.audience !== "all" && b.audience !== context) return false;
          return true;
        });

        let dbDismissed = new Set<string>();
        if (user) {
          const { data: dis } = await supabase
            .from("system_broadcast_dismissals")
            .select("broadcast_id")
            .eq("user_id", user.id);
          dbDismissed = new Set((dis || []).map((d: any) => d.broadcast_id));
        }

        if (!cancelled) {
          setDismissed(new Set([...localDismissed, ...dbDismissed]));
          setItems(filtered as any);
        }
      } catch {
        /* silent */
      }
    })();
    return () => { cancelled = true; };
  }, [context, location.pathname]);

  const handleDismiss = async (id: string) => {
    setDismissed(prev => new Set(prev).add(id));
    const local = new Set<string>(JSON.parse(localStorage.getItem("gf_dismissed_broadcasts") || "[]"));
    local.add(id);
    localStorage.setItem("gf_dismissed_broadcasts", JSON.stringify(Array.from(local)));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("system_broadcast_dismissals").insert({ broadcast_id: id, user_id: user.id });
      }
    } catch { /* silent */ }
  };

  const visible = items.filter(b => !dismissed.has(b.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 p-3">
      {visible.slice(0, 2).map((b) => {
        const style = LEVEL_STYLES[b.level];
        const Icon = style.icon;
        return (
          <div
            key={b.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${style.bg} backdrop-blur-md shadow-sm animate-in fade-in slide-in-from-top-2 duration-300`}
          >
            <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${style.text}`} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm tracking-tight">{b.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{b.message}</div>
              {b.link_url && (
                <a
                  href={b.link_url}
                  target={b.link_url.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  className={`inline-flex items-center gap-1 mt-1.5 text-xs font-medium ${style.text} hover:underline`}
                >
                  {b.link_label || "Saber mais"}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <button
              onClick={() => handleDismiss(b.id)}
              className="p-1 rounded-md hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
