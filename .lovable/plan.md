# Condições comerciais por oficina com sincronização Stripe

## Objetivo
Substituir o desconto administrativo atual, que apenas altera dados locais, por condições comerciais reais e verificáveis no Stripe, dentro de **Admin → Oficinas → oficina**, sem criar outro sistema de subscrições nem alterar preços gerais, faturação de oficinas, InvoiceXpress, afiliados, autenticação ou restantes módulos.

## Implementação

### 1. Registo seguro das condições
- Criar uma tabela de condições comerciais ligada à oficina e à subscrição existente, com tipo, valor/percentagem, moeda, ciclo, início/fim, duração, comportamento final, motivo, nota, estado de sincronização e referências Stripe.
- Manter histórico imutável das alterações, remoções, expirações e falhas; nunca apagar a condição anterior ao editar.
- Restringir leitura e alteração financeira ao super-admin autorizado; oficinas não podem alterar condições.
- Adicionar validações de valores, percentagens, datas, ciclo e moeda, mais proteção contra pedidos repetidos.

### 2. Função financeira Stripe-first
- Criar uma função administrativa autenticada que valida super-admin, oficina, plano, cliente e subscrição antes de qualquer alteração.
- Consultar o preço base no catálogo dinâmico existente e o estado real no Stripe.
- Usar descontos Stripe para percentagens e abatimentos; usar schedules/fases para períodos temporários, datas futuras, meses grátis e regresso automático ao preço normal.
- Para preço fixo negociado, reutilizar um Price compatível já existente quando possível e criar apenas quando necessário, identificado para reutilização futura.
- Suportar aplicação imediata ou na próxima renovação; mostrar aviso de prorrata e obter previsão oficial da próxima fatura quando disponível.
- Só marcar `active`/`scheduled` depois de confirmação Stripe; em falha, preservar o estado anterior e guardar `sync_error`.
- Permitir editar, remover, tentar novamente e verificar sincronização sem provocar cobranças duplicadas.

### 3. Checkout, sincronização e webhook existentes
- Fazer o checkout existente aplicar uma condição preparada apenas quando a oficina ainda não possui subscrição Stripe.
- Estender o webhook e a sincronização administrativa para reconhecer schedules/descontos, atualizar estado e expiração, e detetar divergências sem voltar a escrever no Stripe.
- Preservar trials, cancelamentos, upgrades/downgrades, preços por país/ciclo e a proteção de pagamento confirmado já existentes.
- Em mudança de plano, marcar a condição para revisão por defeito; no cancelamento, impedir fases futuras inesperadas e manter o histórico.

### 4. Interface Admin → Oficina
- Criar a secção **Subscrição e Condições Comerciais** com plano, preço padrão, condição atual, preço efetivo, valor posterior, trial, próxima cobrança e estado Stripe reais.
- Criar um formulário simples com campos condicionais para preço normal, preço personalizado temporário/permanente, desconto percentual temporário/permanente, meses grátis e datas específicas.
- Mostrar uma confirmação completa antes de aplicar e desativar o botão enquanto o pedido decorre.
- Mostrar estados `Sincronizado`, `Agendado`, `Pendente` e `Erro`, com ações para remover, editar, tentar novamente e verificar sincronização.
- Mostrar o histórico completo na própria oficina.
- Remover o fluxo antigo de desconto local para evitar duas formas concorrentes de configurar preços.

### 5. Financeiro e afiliados
- Fazer MRR/ARR/ARPU usarem o valor recorrente efetivo confirmado, respeitando condições temporárias e permanentes.
- Manter comissões de afiliados baseadas na receita efetivamente paga, sem alterar a lógica de atribuição atual.
- Manter faturas e receita recebida baseadas nos eventos reais do Stripe.

### 6. Validação
- Criar testes de validação e idempotência para todos os tipos de condição, ciclos mensal/anual, trial, datas futuras, edição, remoção, upgrade/downgrade, cancelamento e falhas Stripe.
- Testar primeiro sem alterar clientes reais; qualquer teste de escrita Stripe será feito apenas em dados de teste identificados.
- Verificar permissões de super-admin, bloqueio a utilizadores de oficina, refresh/logout/login, vista móvel e ausência de erros no painel.

## Detalhes técnicos
- Reutilizar `plans`, `plan_country_prices`, `subscriptions`, `stripe_webhook_events`, `platform_invoices`, checkout, webhook e sincronização existentes.
- Não usar `shop_overrides` para preços; essa tabela continua exclusivamente para funcionalidades e limites.
- Corrigir a sincronização administrativa para resolver planos pelo catálogo dinâmico, não por patamares de preço.
- Guardar montantes em unidades menores da moeda e derivar a moeda/ciclo da subscrição real.
- Não guardar ou expor credenciais Stripe; todas as operações financeiras ficam no servidor.
