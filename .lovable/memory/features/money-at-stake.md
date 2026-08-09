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

Regra: não é lucro, não inventar valores, sempre com etiqueta de origem.

Rentabilidade/produtividade relacionadas: `ServiceForm` mostra Receita/Custos/Lucro/Margem % a partir dos cálculos já persistidos; `LaborTimer` aceita `estimatedHours` (work_orders.labor_hours) e mostra Previsto/Real/Desvio.
