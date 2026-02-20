import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Wrench } from "lucide-react";
import { SERVICE_STATUS_LABELS, type ServiceStatus } from "@/types/garage";
import { Link } from "react-router-dom";

const statusColors: Record<ServiceStatus, string> = {
  open: "bg-info/10 text-info",
  diagnosis: "bg-warning/10 text-warning",
  waiting_approval: "bg-muted text-muted-foreground",
  approved: "bg-success/10 text-success",
  in_progress: "bg-primary/10 text-primary",
  completed: "bg-success/10 text-success",
  delivered: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

export default function Services() {
  const [services, setServices] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const fetchServices = async () => {
    const { data } = await supabase
      .from("work_orders")
      .select("*, clients(name), vehicles(make, model, plate)")
      .order("created_at", { ascending: false });
    if (data) setServices(data);
  };

  useEffect(() => { fetchServices(); }, []);

  const filtered = services.filter(s =>
    s.number?.toLowerCase().includes(search.toLowerCase()) ||
    (s.clients as any)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Serviços</h1>
          <p className="text-muted-foreground text-sm mt-1">{services.length} serviços</p>
        </div>
        <Link to="/services/new">
          <Button><Plus className="w-4 h-4 mr-2" />Novo Serviço</Button>
        </Link>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Pesquisar serviços..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Veículo</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Lucro</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {services.length === 0 ? "Sem serviços. Crie o primeiro!" : "Nenhum resultado."}
                </TableCell>
              </TableRow>
            ) : filtered.map(s => (
              <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell className="font-medium mono">{s.number}</TableCell>
                <TableCell>{(s.clients as any)?.name}</TableCell>
                <TableCell>{(s.vehicles as any)?.make} {(s.vehicles as any)?.model} — <span className="mono">{(s.vehicles as any)?.plate}</span></TableCell>
                <TableCell className="font-semibold mono">€{s.total?.toFixed(2)}</TableCell>
                <TableCell className="mono text-success">€{s.profit?.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusColors[s.status as ServiceStatus]}>
                    {SERVICE_STATUS_LABELS[s.status as ServiceStatus]}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
