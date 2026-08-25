---
name: Sales Demo Offline
description: /demo-demonstracao é 100% simulada (sem login nem conta demo real) com percurso guiado e troca de plano em contexto
type: feature
---
- Rota `/demo-demonstracao` (src/pages/SalesDemo.tsx): entrada premium e minimal — só escolha de contexto (Start/Pro/Garage com preço real vindo de `country_settings` via regionConfig) + "Começar apresentação" + "Personalizar apresentação" (perfil e necessidades opcionais). Não é página de pricing.
- Não existe plano Free. Rótulo do plano base é sempre "Start" (slug interno `free`).
- Apresentação guiada: `src/components/salesdemo/GuidedDemo.tsx` + etapas em `src/lib/salesDemoTour.ts` + mocks visuais em `DemoStage.tsx`. Fluxo: avançar/voltar/saltar/auto(pausar)/reset, guião curto por etapa, "O que isto resolve", planos, recomendação (via `recommend()` em salesDemoSales) e próximo passo (CTA real `/#pricing`).
- Troca de plano dentro da demo é apenas Demo Context (state local): mantém a etapa atual, não faz login, checkout, nem altera subscrições. Áreas fora do plano ficam com overlay "não incluída".
- Toda a demo é simulada: nenhum acesso a dados reais, nenhuma sessão Supabase.
