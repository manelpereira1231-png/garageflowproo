import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Loader2, TrendingUp, AlertTriangle, Eye, MousePointerClick, FileText, Building2, Inbox } from "lucide-react";

/**
 * Growth Opportunities — read-only painel admin que cruza dados REAIS já existentes
 * (sem novas tabelas). Mostra:
 *   1. Oficinas registadas há >7 dias sem clientes nem viaturas (onboarding falhado)
 *   2. Páginas com tráfego mas zero conversões (landing_visits)
 *   3. Posts de blog publicados sem visitas
 *   4. Anúncios Market publicados há >30 dias sem visualizações
 */
export default function AdminGrowthOpportunities() {
  const [loading, setLoading] = useState(true);
  const [staleShops, setStaleShops] = useState<any[]>([]);
  const [noConvPages, setNoConvPages] = useState<any[]>([]);
  const [zeroViewPosts, setZeroViewPosts] = useState<any[]>([]);
  const [staleListings, setStaleListings] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      // 1) Oficinas frias: criadas há >7d, 0 clientes, 0 viaturas
      const { data: shops } = await supabase
        .from("shops")
        .select("id, name, owner_email, created_at, country")
        .lt("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(200);

      const shopIds = (shops || []).map((s: any) => s.id);
      let stale: any[] = [];
      if (shopIds.length > 0) {
        const [{ data: clients }, { data: vehicles }] = await Promise.all([
          supabase.from("clients").select("shop_id").in("shop_id", shopIds),
          supabase.from("vehicles").select("shop_id").in("shop_id", shopIds),
        ]);
        const activeIds = new Set([
          ...(clients || []).map((c: any) => c.shop_id),
          ...(vehicles || []).map((v: any) => v.shop_id),
        ]);
        stale = (shops || []).filter((s: any) => !activeIds.has(s.id));
      }
      setStaleShops(stale.slice(0, 50));

      // 2) Páginas com tráfego mas zero conversões (últimos 30 dias)
      const { data: visits } = await supabase
        .from("landing_visits")
        .select("landing_path, converted_signup, converted_paid")
        .gte("created_at", thirtyDaysAgo);

      const pageStats: Record<string, { views: number; conv: number }> = {};
      (visits || []).forEach((v: any) => {
        const p = v.landing_path || "(unknown)";
        if (!pageStats[p]) pageStats[p] = { views: 0, conv: 0 };
        pageStats[p].views++;
        if (v.converted_signup || v.converted_paid) pageStats[p].conv++;
      });
      const noConv = Object.entries(pageStats)
        .filter(([_, s]) => s.views >= 20 && s.conv === 0)
        .map(([path, s]) => ({ path, ...s }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 30);
      setNoConvPages(noConv);

      // 3) Posts de blog publicados sem visitas
      const { data: posts } = await supabase
        .from("seo_blog_posts")
        .select("id, slug, title, views, published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(100);
      const zeroViews = (posts || []).filter((p: any) => (p.views || 0) === 0);
      setZeroViewPosts(zeroViews.slice(0, 30));

      // 4) Anúncios Market sem views (>30d)
      const { data: listings } = await supabase
        .from("carity_listings")
        .select("id, make, model, year, price, published_at")
        .eq("status", "published")
        .lt("published_at", thirtyDaysAgo)
        .order("published_at", { ascending: false })
        .limit(200);

      const lIds = (listings || []).map((l: any) => l.id);
      let zeroLi: any[] = [];
      if (lIds.length > 0) {
        const { data: views } = await supabase
          .from("listing_views")
          .select("listing_id")
          .in("listing_id", lIds);
        const seen = new Set((views || []).map((v: any) => v.listing_id));
        zeroLi = (listings || []).filter((l: any) => !seen.has(l.id));
      }
      setStaleListings(zeroLi.slice(0, 30));

      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <TrendingUp className="h-7 w-7 text-primary" />
          Oportunidades de Crescimento
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Apenas dados reais — cruzamento de oficinas, tráfego, anúncios e blog dos últimos 30 dias.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} label="Oficinas frias" value={staleShops.length} hint=">7d sem clientes/viaturas" tone="amber" />
        <StatCard icon={MousePointerClick} label="Páginas sem conversão" value={noConvPages.length} hint="≥20 visitas, 0 signups" tone="red" />
        <StatCard icon={FileText} label="Posts sem visitas" value={zeroViewPosts.length} hint="publicados, 0 views" tone="slate" />
        <StatCard icon={Eye} label="Anúncios sem visualizações" value={staleListings.length} hint=">30d publicados" tone="amber" />
      </div>

      {/* 1. Stale shops */}
      <Section
        icon={Building2}
        title={`Oficinas registadas mas inactivas (${staleShops.length})`}
        description="Sem clientes nem viaturas após 7 dias do registo. Bom alvo para email de reactivação ou contacto direto."
      >
        {staleShops.length === 0 ? (
          <Empty msg="Todas as oficinas registadas há mais de 7 dias têm pelo menos um cliente ou viatura." />
        ) : (
          <ul className="divide-y divide-border">
            {staleShops.map((s) => (
              <li key={s.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{s.name || "(sem nome)"}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {s.owner_email} · {s.country || "?"} · registo {new Date(s.created_at).toLocaleDateString("pt-PT")}
                  </div>
                </div>
                <Link to={`/admin/shops/${s.id}`}><Button variant="ghost" size="sm">Abrir</Button></Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 2. Pages with traffic but zero conversions */}
      <Section
        icon={MousePointerClick}
        title={`Páginas com tráfego mas zero conversão (${noConvPages.length})`}
        description="Páginas com ≥20 visitas nos últimos 30 dias e nenhum signup ou pagamento. Rever copy, CTA ou velocidade."
      >
        {noConvPages.length === 0 ? (
          <Empty msg="Sem páginas problemáticas neste período." />
        ) : (
          <ul className="divide-y divide-border">
            {noConvPages.map((p) => (
              <li key={p.path} className="py-2 flex items-center justify-between gap-2 text-sm">
                <code className="text-xs truncate flex-1">{p.path}</code>
                <Badge variant="secondary">{p.views} visitas</Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 3. Zero-view blog posts */}
      <Section
        icon={FileText}
        title={`Posts de blog publicados sem visitas (${zeroViewPosts.length})`}
        description="Conteúdo já no ar mas sem tráfego. Reforçar internal linking, partilhar nas redes ou re-otimizar título/meta."
      >
        {zeroViewPosts.length === 0 ? (
          <Empty msg="Todos os posts publicados têm pelo menos uma visita." />
        ) : (
          <ul className="divide-y divide-border">
            {zeroViewPosts.map((p) => (
              <li key={p.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                <Link to={`/blog/${p.slug}`} target="_blank" className="truncate flex-1 hover:underline">
                  {p.title}
                </Link>
                <span className="text-xs text-muted-foreground">{p.published_at ? new Date(p.published_at).toLocaleDateString("pt-PT") : "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 4. Stale listings */}
      <Section
        icon={Eye}
        title={`Anúncios sem visualizações há +30 dias (${staleListings.length})`}
        description="Listagens publicadas sem qualquer view registada. Possível candidato a destaque, boost ou ajuste de preço."
      >
        {staleListings.length === 0 ? (
          <Empty msg="Todos os anúncios antigos têm pelo menos uma visualização." />
        ) : (
          <ul className="divide-y divide-border">
            {staleListings.map((l) => (
              <li key={l.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{l.make} {l.model}</span>{" "}
                  <span className="text-muted-foreground text-xs">· {l.year} · €{l.price?.toLocaleString()}</span>
                </div>
                <span className="text-xs text-muted-foreground">{l.published_at ? new Date(l.published_at).toLocaleDateString("pt-PT") : "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint, tone }: { icon: any; label: string; value: number; hint: string; tone: "amber" | "red" | "slate" }) {
  const toneCls = tone === "red" ? "text-red-500" : tone === "amber" ? "text-amber-500" : "text-slate-500";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className={`h-4 w-4 ${toneCls}`} />
          {label}
        </div>
        <div className="text-3xl font-bold mt-1">{value}</div>
        <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>
      </CardContent>
    </Card>
  );
}

function Section({ icon: Icon, title, description, children }: { icon: any; title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-2">
      <Inbox className="h-8 w-8" />
      <p className="text-sm text-center">{msg}</p>
    </div>
  );
}
