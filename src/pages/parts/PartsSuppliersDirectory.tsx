/**
 * Diretório de Fornecedores (B2B parts marketplace).
 * Lista todos os fornecedores aprovados e ativos, com link para o catálogo.
 * Escondido pela feature flag `supplier_network_enabled` via PartsMarketplaceGate.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Store, Star, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SupplierRow {
  id: string;
  slug: string | null;
  company_name: string;
  trade_name: string | null;
  logo_url: string | null;
  city: string | null;
  country: string | null;
  rating_average: number;
  avg_processing_hours: number | null;
  description: string | null;
}

export default function PartsSuppliersDirectory() {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("gsn_suppliers" as any)
        .select("id,slug,company_name,trade_name,logo_url,city,country,rating_average,avg_processing_hours,description")
        .eq("approved", true)
        .eq("active", true)
        .is("deleted_at", null)
        .order("rating_average", { ascending: false })
        .limit(200);
      setSuppliers((data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = suppliers.filter((s) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return [s.company_name, s.trade_name, s.city, s.country].some((v) =>
      (v ?? "").toLowerCase().includes(needle),
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Store className="w-6 h-6 text-primary" />
          Fornecedores
        </h1>
        <p className="text-sm text-muted-foreground">
          Rede de fornecedores B2B de peças automóveis aprovados pelo GarageFlow.
        </p>
      </div>

      <Input placeholder="Pesquisar fornecedor, cidade..." value={q} onChange={(e) => setQ(e.target.value)} />

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">A carregar...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum fornecedor disponível.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <Link key={s.id} to={`/parts/supplier/${s.slug ?? s.id}`} className="block">
              <Card className="hover:border-primary transition-colors h-full">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    {s.logo_url ? (
                      <img src={s.logo_url} alt={s.company_name} className="w-12 h-12 rounded object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded bg-accent flex items-center justify-center">
                        <Store className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{s.trade_name || s.company_name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[s.city, s.country].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                  </div>
                  {s.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="secondary" className="gap-1">
                      <Star className="w-3 h-3" /> {Number(s.rating_average || 0).toFixed(1)}
                    </Badge>
                    {s.avg_processing_hours != null && (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="w-3 h-3" /> {s.avg_processing_hours}h
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
