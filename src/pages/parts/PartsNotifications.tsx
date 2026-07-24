import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGsnNotifications } from "@/hooks/useGsnNotifications";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Bell } from "lucide-react";

export default function PartsNotifications() {
  const { items, markRead } = useGsnNotifications();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Notificações</h1>
      <Card>
        <CardHeader><CardTitle>{items.length}</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? <p className="text-sm text-muted-foreground flex items-center gap-2"><Bell className="w-4 h-4" />Sem notificações.</p> : (
            <div className="space-y-2">
              {items.map((n) => (
                <div key={n.id} className={`p-3 border rounded-md ${!n.read ? "bg-primary/5" : ""}`} onClick={() => !n.read && markRead(n.id)}>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{n.kind}</Badge>
                    <span className="text-xs text-muted-foreground">{format(new Date(n.created_at), "dd/MM HH:mm")}</span>
                  </div>
                  <p className="text-sm font-medium mt-1">{n.title}</p>
                  {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                  {n.link && <Link to={n.link} className="text-xs text-primary hover:underline">Abrir</Link>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
