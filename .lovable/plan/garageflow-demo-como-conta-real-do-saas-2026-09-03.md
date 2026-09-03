# GarageFlow Demo como conta real do SaaS

## Objetivo
Substituir a aplicação Demo paralela por sessões temporárias e isoladas da aplicação GarageFlow real. `/demo` e `/demo-demonstracao` usam o mesmo `Layout`, router, páginas, componentes, validações e modelo de dados do ERP; apenas a orientação comercial difere.

## Estado atual confirmado
- As duas rotas ignoram atualmente o router/auth real e renderizam uma réplica estática através de `SelfDemo`, `SalesDemo`, `GuidedDemo` e `DemoStage`.
- Já existe infraestrutura desligada (`startDemo`, função `sales-demo` e `SalesDemoBar`) capaz de iniciar uma sessão real no ERP.
- Essa infraestrutura não pode ser reativada como está: usa uma conta/oficina partilhada, permite colisões entre visitantes e não isola emails, pagamentos, automações ou outras integrações externas.
- As notificações de orçamento abrem atualmente a listagem pesquisada; este requisito passa a exigir o detalhe real `/quotes/edit/:id`.

## Implementação

### 1. Sessão Demo isolada
- Evoluir a infraestrutura existente para criar uma conta e oficina Demo temporárias por sessão, identificadas como Demo e com expiração.
- Semear `AutoPrime Lisboa` usando as tabelas reais e relações reais: cliente, viatura, orçamento e linhas, ordem de serviço, agenda, stock, fatura, alertas e notificações.
- Aplicar as mesmas permissões e RLS de uma oficina normal; não criar tabelas paralelas nem modelos alternativos.
- Proteger o arranque/reset público com rate limiting e validação de ações.
- Limpar automaticamente tenants Demo expirados e limpar completamente sessão/contexto local ao terminar.

### 2. Isolamento de efeitos externos
- Propagar a identificação Demo a partir da oficina ativa.
- Manter formulários, validações e mutações reais dentro do tenant Demo.
- Bloquear ou simular de forma explícita apenas efeitos externos irreversíveis: emails/SMS/WhatsApp reais, pagamentos, webhooks, publicação e automações externas.
- Impedir qualquer acesso ou escrita em oficinas reais; manter `activeShopId` e cache separados entre Demo e sessões normais.

### 3. Routing e aplicação real
- Remover o curto-circuito por `window.location.pathname` e integrar as rotas Demo no router normal.
- Ao entrar em `/demo` ou `/demo-demonstracao`, iniciar/restaurar a sessão Demo e encaminhar para o Dashboard real preservando o modo Demo no URL/contexto.
- Reutilizar `Layout`, sidebar, topbar e todas as rotas/páginas reais; a navegação interna mantém o utilizador no contexto Demo.
- Não alterar o comportamento das contas normais nem facilitar a Demo com branches visuais dentro das páginas de negócio.

### 4. Modos autónomo e comercial
- `/demo`: aplicação real sem scripts, objeções, notas internas ou consola comercial; manter apenas uma ação discreta para terminar/experimentar, ligada diretamente a `/auth?mode=signup`.
- `/demo-demonstracao`: exatamente a mesma aplicação e conta Demo, com uma camada comercial discreta sobreposta.
- Reaproveitar apenas a configuração útil de tour e argumentação existente; substituir `DemoStage` e restantes réplicas visuais por navegação real.
- A camada comercial nunca substitui, redimensiona ou altera as páginas reais.

### 5. Orçamentos e notificações
- Fazer notificações de orçamento da topbar e da página Notificações resolverem `data.quote_id` para `/quotes/edit/:id`.
- Preservar uma referência inequívoca ao orçamento nas notificações novas e corrigir links Demo/existentes quando seguro.
- Validar o fluxo real Orçamento → aprovação → ordem de serviço usando os registos relacionados do tenant Demo.

### 6. Remoção da arquitetura paralela
- Remover apenas componentes Demo que reconstruam visualmente o ERP depois de as duas rotas estarem na aplicação real.
- Manter conteúdo/configuração comercial reutilizável e o controlo discreto de sessão Demo.
- Não criar `DemoDashboard`, `DemoClients`, `DemoQuotes` ou equivalentes.

## Validação obrigatória
- Testar arranque, reset, fim e nova sessão Demo sem dados cruzados entre dois browsers concorrentes.
- Comparar aplicação normal e Demo, módulo a módulo, em desktop e mobile: Dashboard, Clientes, Veículos, Serviços, Orçamentos, Agenda, Stock, Alertas, Faturação, Relatórios, Modo Oficina e Notificações.
- Exercitar a cadeia Cliente → Viatura → Serviço → Orçamento → OS → Agenda/Stock → Fatura nas rotas reais.
- Testar notificações de orçamento pela topbar e pela página Notificações, confirmando abertura do detalhe específico.
- Confirmar que integrações externas não disparam e que nenhuma oficina real é lida ou alterada.
- Executar typecheck e verificações funcionais; no relatório final, marcar como `NÃO VALIDADO` tudo o que não tiver evidência visual ou funcional.

## Componentes reais previstos para reutilização
`Layout`, `Dashboard`, `Clients`, `Vehicles`, `Services`, `Quotes`, `QuoteForm`, `Appointments`, `Stock`, `Invoices`, `Reports`, `Workshop`, `Notifications`, `NotificationsBell`, filtros e componentes do design system já usados por estas páginas.

## Alterações de dados previstas
- Migração mínima para identificar e expirar oficinas Demo e suportar limpeza segura.
- Atualização da função Demo existente para provisionamento isolado, seed relacional e reset por sessão.
- Sem novas tabelas de negócio e sem duplicação do esquema ERP.
