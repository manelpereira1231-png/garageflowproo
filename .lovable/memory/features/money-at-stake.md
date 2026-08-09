---
name: Dinheiro em Jogo / Oportunidades
description: Métrica de valor potencial no Dashboard (orçamentos pendentes, faturas por receber, revisões em atraso) + página /opportunities
type: feature
---
# Dinheiro em Jogo

Fonte única: `src/hooks/useMoneyAtStake.ts`. NUNCA criar um segundo cálculo.

Origens rastreáveis (tabelas existentes):
- Orçamentos pendentes: `quotes` status draft/sent e `validity_date` ainda válida → soma `total`.
- Pagamentos pendentes: `invoices` status issued/partial menos `payments.amount` desse invoice (só saldo > 0).
- Clientes a recuperar: `service_reminders` status pending com `next_service_date` < hoje × ticket médio REAL (últimas 100 OS completed/delivered). Sem histórico → valor 0, mostra só a lista.

UI:
- Cartão `MoneyAtStakeCard` no fim de `src/pages/Dashboard.tsx` (OwnerDashboard), respeita o modo Grupo via `stakeShopIds`. Estado vazio: "Não existem oportunidades neste momento."
- Detalhe em `/opportunities` (`src/pages/Opportunities.tsx`), capability `quotes.view` em `rolePaths.ts`.

Regra semântica (obrigatória): NUNCA somar valor real com estimativa.
- `confirmedTotal` = "DINHEIRO EM JOGO" = orçamentos pendentes + faturas por receber (valores reais).
- `estimatedTotal` = "POTENCIAL ESTIMADO" = revisões vencidas × ticket médio histórico, apresentado à parte, com `~`, em card tracejado e com a nota "não é dinheiro confirmado".
- Cada bloco mostra a origem e a contagem (N orçamentos / N faturas / N viaturas).

Rentabilidade/produtividade relacionadas: `ServiceForm` mostra Receita/Custos/Lucro/Margem % a partir dos cálculos já persistidos; `LaborTimer` aceita `estimatedHours` (work_orders.labor_hours) e mostra Previsto/Real/Desvio.
