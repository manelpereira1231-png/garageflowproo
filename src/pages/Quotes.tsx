import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileText } from "lucide-react";
import { QUOTE_STATUS_LABELS, type QuoteStatus } from "@/types/garage";
import { Link } from "react-router-dom";

const statusColors: Record<QuoteStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-info/10 text-info",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  expired: "bg-muted text-muted-foreground",
  converted: "bg-primary/10 text-primary",
};

export default function Quotes() {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const fetchQuotes = async () => {
    const { data } = await supabase
      .from("quotes")
      .select("*, clients(name), vehicles(make, model, plate)")
      .order("created_at", { ascending: false });
    if (data) setQuotes(data);
  };

  useEffect(() => { fetchQuotes(); }, []);

  const filtered = quotes.filter(q =>
    q.number?.toLowerCase().includes(search.toLowerCase()) ||
    (q.clients as any)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Orçamentos</h1>
          <p className="text-muted-foreground text-sm mt-1">{quotes.length} orçamentos</p>
        </div>
        <Link to="/quotes/new">
          <Button><Plus className="w-4 h-4 mr-2" />Novo Orçamento</Button>
        </Link>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Pesquisar orçamentos..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
                  {quotes.length === 0 ? "Sem orçamentos. Crie o primeiro!" : "Nenhum resultado."}
                </TableCell>
              </TableRow>
            ) : filtered.map(q => (
              <TableRow key={q.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell className="font-medium mono">{q.number}</TableCell>
                <TableCell>{(q.clients as any)?.name}</TableCell>
                <TableCell>{(q.vehicles as any)?.make} {(q.vehicles as any)?.model} — <span className="mono">{(q.vehicles as any)?.plate}</span></TableCell>
                <TableCell className="font-semibold mono">€{q.total?.toFixed(2)}</TableCell>
                <TableCell className="mono text-success">€{q.profit?.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusColors[q.status as QuoteStatus]}>
                    {QUOTE_STATUS_LABELS[q.status as QuoteStatus]}
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
