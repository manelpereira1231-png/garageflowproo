import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Euro, Banknote, ShieldCheck, FileText, Clock, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { useCountryPricing } from "@/hooks/useCountryPricing";

/**
 * Transparent breakdown of how partner workshops earn and receive money
 * from GarageFlow Market (inspections + commissions). Goal: zero ambiguity.
 */
export default function MarketPayoutInfo() {
  const { pricing, formatPrice } = useCountryPricing();
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="text-center space-y-2">
        <Badge className="bg-amber-500 text-slate-900">Transparência total</Badge>
        <h1 className="text-3xl font-bold">Como a oficina ganha e recebe</h1>
        <p className="text-muted-foreground">Tudo o que precisa de saber sobre pagamentos no GarageFlow Market.</p>
      </div>

      {/* Block 1 — Inspections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5 text-amber-500" /> 1. Inspeções pagas ({formatPrice(pricing.inspection_price)})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            Sempre que um vendedor publica um carro no Market, paga <strong>{formatPrice(pricing.inspection_price)}</strong> para que uma oficina
            parceira faça uma inspeção física do veículo. Esse pagamento é dividido automaticamente:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="border rounded-lg p-4 bg-emerald-50 dark:bg-emerald-950/20">
              <p className="text-xs uppercase font-bold text-emerald-700 dark:text-emerald-400">Oficina recebe</p>
              <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{formatPrice(pricing.inspection_shop_share)}</p>
              <p className="text-xs text-muted-foreground mt-1">por cada inspeção concluída</p>
            </div>
            <div className="border rounded-lg p-4 bg-muted/40">
              <p className="text-xs uppercase font-bold text-muted-foreground">GarageFlow (plataforma)</p>
              <p className="text-3xl font-bold">{formatPrice(pricing.inspection_platform_share)}</p>
              <p className="text-xs text-muted-foreground mt-1">cobre Stripe, IVA, suporte e infra</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-xs">
              Só recebe o valor se completar e submeter o relatório de inspeção. Inspeções recusadas ou não
              concluídas não geram pagamento.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Block 2 — Commission on car sales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-amber-500" /> 2. Comissão sobre vendas (opcional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            O GarageFlow cobra apenas <strong>2 %</strong> de comissão sobre o valor final da venda do veículo —
            paga pelo comprador. A oficina <strong>não tem custos adicionais</strong>.
          </p>
          <p className="text-muted-foreground text-xs">
            A inspeção feita pela sua oficina é o que dá confiança ao comprador. Mais inspeções concluídas →
            mais carros vendidos → maior visibilidade da sua oficina.
          </p>
        </CardContent>
      </Card>

      {/* Block 3 — How payouts work */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" /> 3. Como e quando recebe o dinheiro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-7 w-7 rounded-full bg-amber-500 text-slate-900 flex items-center justify-center font-bold shrink-0">1</div>
              <div>
                <p className="font-semibold">Aceita o pedido de inspeção</p>
                <p className="text-muted-foreground text-xs">Notificação chega em tempo real (toast + banner + push).</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-7 w-7 rounded-full bg-amber-500 text-slate-900 flex items-center justify-center font-bold shrink-0">2</div>
              <div>
                <p className="font-semibold">Agenda e realiza a inspeção física</p>
                <p className="text-muted-foreground text-xs">Contacto com vendedor via WhatsApp integrado.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-7 w-7 rounded-full bg-amber-500 text-slate-900 flex items-center justify-center font-bold shrink-0">3</div>
              <div>
                <p className="font-semibold">Submete o relatório completo</p>
                <p className="text-muted-foreground text-xs">Mínimo de fotos + checklist de componentes obrigatório.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-7 w-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold shrink-0">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold">Pagamento processado</p>
                <p className="text-muted-foreground text-xs">
                  Os {formatPrice(pricing.inspection_shop_share)} são creditados na sua conta no <strong>fecho do mês seguinte</strong> (até dia 10),
                  por transferência bancária para o IBAN registado nas Definições.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Block 4 — Required setup */}
      <Card className="border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-500" /> 4. O que precisa de configurar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ul className="space-y-2 list-disc pl-5">
            <li><strong>NIF da empresa</strong> — para emissão da fatura mensal de comissões.</li>
            <li><strong>IBAN</strong> da conta bancária da oficina — destino dos pagamentos.</li>
            <li><strong>Email e telefone</strong> validados — para receber notificações urgentes.</li>
            <li><strong>Estado "Parceira ativa"</strong> — ativado nas Definições do Market.</li>
          </ul>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/settings">
              Ir para Definições <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Block 5 — Legal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" /> 5. Notas legais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>
            Os valores indicados são líquidos para a oficina, sujeitos à legislação fiscal portuguesa.
            A oficina é responsável pela emissão de fatura/recibo válida pelos serviços de inspeção prestados.
          </p>
          <p>
            Os pagamentos são processados via Stripe Connect, com verificação automática de identidade.
            Em caso de litígio entre comprador e vendedor, o pagamento da inspeção <strong>não é afetado</strong> —
            o trabalho da oficina é independente do desfecho da venda.
          </p>
          <p>
            Consulte os <Link to="/legal/terms" className="underline">Termos de Serviço</Link> e o
            {" "}<Link to="/legal/dpa" className="underline">DPA</Link> para detalhes completos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
