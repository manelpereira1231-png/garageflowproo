import { Link } from "react-router-dom";
import { Bell, Building2, CreditCard, Sparkles, CheckCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdminNotifications } from "@/hooks/useAdminNotifications";

const ICONS = {
  shop_signup: Building2,
  payment: CreditCard,
  subscription: Sparkles,
} as const;

export default function AdminNotifications() {
  const { items, loading, unreadCount, isRead, markRead, markAllRead } = useAdminNotifications(80);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" /> Notificações
          </h1>
          <p className="text-sm text-muted-foreground">Registos de oficinas, pagamentos e subscrições em tempo real.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => markAllRead()}>
          <CheckCheck className="w-4 h-4 mr-2" /> Marcar como lidas
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Últimos 30 dias {unreadCount > 0 && <Badge className="ml-2">{unreadCount} novas</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">A carregar…</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Sem atividade nos últimos 30 dias.</div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((n) => {
                const Icon = ICONS[n.kind];
                const isNew = new Date(n.at).getTime() > new Date(readAt).getTime();
                return (
                  <Link
                    key={n.id}
                    to={n.link}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors ${isNew ? "bg-primary/5" : ""}`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium flex items-center gap-2">
                        {n.title}
                        {isNew && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{n.description}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(n.at).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
