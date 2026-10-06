# Roadmap

- [x] Simplificar o fluxo dos Sinistros com divulgação progressiva e ação direta para preparar o pedido ao perito; identidade da viatura no pacote; 16 testes PT/BR aprovados e vistas desktop/mobile verificadas com dados simulados, sem gravações ou envios reais.

- [x] Sinistros: plano v2 aprovado; reaproveitar dados e ferramentas existentes.
- [x] Sinistros v2: verificar página única, gravação do essencial, autorizações, decisão de perda total, abertura da fatura, fotografias privadas e links expirados no navegador PT; 14 testes PT/BR aprovados; visual BR verificado com resposta de país simulada, sem mudar a oficina PT; dados temporários apagados.
- [ ] Sinistros v2: emissão fiscal real e entrega real de emails/WhatsApp por confirmar; não executar cobranças/emissões nem contactar clientes durante os testes; teste integral numa oficina BR real pendente de contexto autorizado.

- [x] Agenda mobile (lista por dia; falta testar gravação no ecrã)
- [x] Reorganizar ficha de Sinistros
- [ ] Notas de crédito parciais: feitas, falta teste numa oficina Pro
- [ ] Registar compatibilidade real de peças e pesquisar por veículo/referência
- [ ] Corrigir abertura única de WhatsApp em PC/mobile sem PDF obrigatório
- [ ] Corrigir moeda do temporizador conforme oficina ativa
- [ ] Validar segurança, persistência e utilização mobile/desktop; corrigir falhas encontradas

- [x] Audit current Demo, real routing, tenant context, notifications, and reusable pages/components
- [x] Design the minimum safe architecture for a real demo tenant with autonomous/commercial modes
- [x] Replace parallel Demo UI with real SaaS pages and isolated demo context/data
- [x] Validate navigation, notifications, visual fidelity, and responsive behavior
- [ ] Finish reactive removal of Demo-only visuals after real signup
- [ ] Correct Demo client cards on mobile/iPad and remove the call action
- [ ] Validate Demo-to-real transition, refresh, mobile, and iPad layouts
- [x] Implementar condições comerciais por oficina sincronizadas realmente com Stripe

- [x] Agenda: arrastar marcações para outro dia/hora (computador/tablet)
- [x] Filtro "Com nota de crédito" nas faturas (InvoiceXpress total + parcial já existiam)
- [x] Brasil: página inicial, demo BR (AutoPrime São Paulo), país da oficina corrigido
- [ ] Testar emissão real de nota de crédito no InvoiceXpress (precisa de oficina com InvoiceXpress ligado)
