import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Receipt, UserCheck, Target, ChevronRight } from "lucide-react";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { useMoneyAtStake } from "@/hooks/useMoneyAtStake";
import { formatMoney } from "@/lib/money";

/**
 * Detalhe do "Dinheiro em jogo" do Dashboard. Não é um dashboard novo nem um
 * sistema financeiro paralelo: apenas lista, com origem rastreável, as
 * oportunidades já existentes (orçamentos, faturas por receber, revisões em
 * atraso) e liga aos registos reais.
 */
export default function Opportunities() {
  const shopId = useActiveShopId();
  const stake = useMoneyAtStake(shopId ? [shopId] : []);

  if (stake.loading) {
    return <div className="p-4 sm:p-6 space-y-4"><Skeleton className="h-28 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  const empty = stake.quotes.length === 0 && stake.invoices.length === 0 && stake.reminders.length === 0;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Target className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Oportunidades</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Valor real já existente no sistema, separado do potencial estimado. Cada valor tem origem rastreável.
          </p>
        </div>
      </header>

      {empty ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Não existem oportunidades neste momento.
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="p-5">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Dinheiro em jogo</p>
              <p className="text-3xl sm:text-4xl font-bold tabular-nums mt-1">{formatMoney(stake.confirmedTotal)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Valor real: orçamentos pendentes + faturas por receber.</p>
            </Card>
            <Card className="p-5 border-dashed">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Potencial estimado</p>
              <p className="text-3xl sm:text-4xl font-bold tabular-nums mt-1 text-muted-foreground">
                {stake.estimatedTotal > 0 ? `~${formatMoney(stake.estimatedTotal)}` : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {stake.estimatedTotal > 0
                  ? "Estimativa baseada no ticket médio histórico — não é dinheiro confirmado."
                  : "Sem histórico suficiente para estimar valor."}
              </p>
            </Card>
          </div>


          {/* Orçamentos pendentes */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-sm">Orçamentos pendentes</h2>
                <Badge variant="outline">{stake.quotes.length} {stake.quotes.length === 1 ? "orçamento" : "orçamentos"}</Badge>
              </div>
              <span className="font-bold tabular-nums text-sm">{formatMoney(stake.quotesValue)}</span>
            </div>
            {stake.quotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem orçamentos por fechar.</p>
            ) : (
              <ul className="divide-y divide-border">
                {stake.quotes.slice(0, 20).map((q) => {
                  const days = Math.max(0, Math.floor((Date.now() - new Date(q.created_at).getTime()) / 86400000));
                  return (
                    <li key={q.id}>
                      <Link to={`/quotes/edit/${q.id}`} className="py-2 flex items-center justify-between gap-2 hover:text-primary">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs text-muted-foreground">{q.number || "—"}</span>
                          <span className="truncate text-sm">{q.clientName || "Sem cliente"}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {days === 0 ? "hoje" : `${days} ${days === 1 ? "dia" : "dias"} sem aprovação`}
                          </Badge>
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-semibold tabular-nums">{formatMoney(q.total)}</span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </span>
                      </Link>
                    </li>
                  );
                })}

              </ul>
            )}
          </Card>

          {/* Pagamentos pendentes */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-500" />
                <h2 className="font-semibold text-sm">Faturas por receber</h2>
                <Badge variant="outline">{stake.invoices.length} {stake.invoices.length === 1 ? "fatura" : "faturas"}</Badge>
              </div>
              <span className="font-bold tabular-nums text-sm">{formatMoney(stake.paymentsValue)}</span>
            </div>
            {stake.invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem faturas por receber.</p>
            ) : (
              <ul className="divide-y divide-border">
                {stake.invoices.slice(0, 20).map((i) => (
                  <li key={i.id}>
                    <Link to={`/invoices/${i.id}`} className="py-2 flex items-center justify-between gap-2 hover:text-primary">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs text-muted-foreground">{i.number || "—"}</span>
                        <span className="truncate text-sm">{i.clientName || "Sem cliente"}</span>
                        {i.overdue && <Badge variant="destructive" className="text-[10px]">Vencida</Badge>}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold tabular-nums">{formatMoney(i.outstanding)}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Clientes a recuperar — POTENCIAL ESTIMADO, nunca somado ao valor real */}
          <Card className="p-4 sm:p-5 border-dashed">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-500" />
                <h2 className="font-semibold text-sm">Revisões vencidas</h2>
                <Badge variant="outline">{stake.reminders.length} {stake.reminders.length === 1 ? "viatura" : "viaturas"}</Badge>
              </div>
              <span className="font-bold tabular-nums text-sm text-muted-foreground">
                {stake.recoveryValue > 0 ? `~${formatMoney(stake.recoveryValue)}` : "—"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">
              {stake.avgTicket > 0
                ? `Potencial estimado com base no ticket médio histórico (${formatMoney(stake.avgTicket)}) — não é dinheiro confirmado.`
                : "Sem histórico suficiente para estimar valor — mostramos apenas a lista."}
            </p>
            {stake.reminders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem revisões em atraso.</p>
            ) : (
              <ul className="divide-y divide-border">
                {stake.reminders.slice(0, 20).map((r) => (
                  <li key={r.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">
                      {r.clientName || "Sem cliente"}
                      {r.plate ? <span className="text-muted-foreground"> · {r.plate}</span> : null}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {r.service_type || "Revisão"}{r.next_service_date ? ` · ${r.next_service_date}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <Button asChild size="sm" variant="outline"><Link to="/clients">Ver clientes</Link></Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
