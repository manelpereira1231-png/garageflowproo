# Sinistros — Fase 1 (Auditoria) e Fase 2 (Plano)

Nada foi alterado. Este plano é a resposta às Fases 1 e 2. Cada fase seguinte só avança depois de "APROVADO" e da tua confirmação no fim de cada fase.

## Fase 1 — O que já existe

**Já funciona (não mexer na lógica):**
- Uma única ficha de sinistro com 6 separadores: Resumo, Processo e peritagem, Orçamento e reparação, Valores e faturação (Nota fiscal no Brasil), Documentos e comunicações, Histórico.
- Ligações a cliente, viatura, seguradora (catálogo central + seguradoras da oficina), orçamento e ordem de serviço, com links nos dois sentidos.
- Estados completos (19), progresso clicável, "próxima ação" com data e responsável, resumo no Dashboard.
- Peritagem: data, hora, local, perito, empresa, nº de relatório, resultado.
- Autorização: estado, data, referência, valores pedidos/aprovados/recusados.
- Franquia, apólice, nº de processo, tipo de sinistro e responsabilidade.
- Documentos por categoria, contactos, comunicações com modelos de email, histórico de eventos.
- Botão "criar Fatura/Nota fiscal" com a seguradora pré-selecionada (PT: InvoiceXpress, BR: eNotas).

**Parcial ou com problemas:**
1. **Faturação:** o sinistro guarda só **uma** fatura. Não dá para ter uma fatura para a seguradora e outra para o cliente.
2. **Destinatário por linha:** não existe. Não se consegue dizer "esta linha paga a seguradora, esta paga o cliente".
3. **Dupla faturação:** nada impede faturar a mesma linha duas vezes.
4. **Valores duplicados:** faturado, pago pela seguradora, pago pelo cliente e pendente são escritos à mão no sinistro, em vez de serem calculados a partir das faturas e pagamentos reais.
5. **Adicionais (danos ocultos):** não existem como registo próprio.
6. **Perda total:** não existe fluxo, decisão do cliente nem encargos (desmontagem, parqueamento).
7. **Imobilização e prazos:** sem data de entrada/saída da viatura nem contagem de dias.
8. **Cliente informado:** só como comunicação genérica, sem indicador na ficha.
9. Algumas datas no histórico e nos cartões estão fixas no formato português (também aparecem assim no Brasil).

**Duplicado:** nada. Existe um só módulo de sinistros e um só catálogo de seguradoras.

**Seguradora como entidade fiscal:** a seguradora é registada à parte dos clientes. Para faturar, é usada como destinatário através do fluxo de faturação que já existe, e o NIF/CNPJ vem dos dados da seguradora.

**Regressões possíveis:** faturação PT/BR, numeração, notas de crédito e relatórios de receita. Por isso, todas as alterações reutilizam as faturas e pagamentos que já existem.

## Fase 2 — Plano de migração (uma fase de cada vez)

**Fase A — Valores reais em vez de valores escritos à mão**
- Ligar cada fatura ao sinistro (uma ligação opcional na fatura, que permite várias faturas por sinistro).
- O resumo financeiro passa a ser calculado: total autorizado, faturado à seguradora, faturado ao cliente, pago e pendente, a partir das faturas, notas de crédito e pagamentos reais.
- Os valores antigos escritos à mão ficam como estão e são mostrados só quando ainda não houver faturas.

**Fase B — Faturar por linhas, com destinatário por linha**
- No sinistro: lista das linhas do orçamento ou ordem de serviço, cada uma marcada como Seguradora, Cliente ou Dividida (valor ou %).
- Botões "Faturar seguradora" e "Faturar cliente", que abrem o formulário de fatura que já existe, preenchido só com as linhas certas.
- Uma linha já faturada fica bloqueada para não ser faturada outra vez (anulando a fatura com nota de crédito, a linha volta a ficar livre).
- A franquia aparece como informação, mas não decide sozinha quem paga o quê.

**Fase C — Adicionais**
- Registar adicionais (descrição, valor, parte da seguradora e parte do cliente, estado da autorização), que entram nas linhas da Fase B.

**Fase D — Perda total**
- Quando a peritagem dá perda total: decisão do cliente (indemnização e entrega do salvado, fica com a viatura, leva sem reparar, outro) e encargos faturáveis à seguradora ou ao cliente, usando a mesma faturação.

**Fase E — Imobilização, prazos e cliente informado**
- Datas de entrada/saída e dias imobilizado, alertas de prazos e um indicador "cliente informado em…".
- Datas da ficha no formato do país (PT ou BR).

Em todas as fases: Portugal continua com Fatura, InvoiceXpress e €. O Brasil continua com Nota fiscal, eNotas e R$. A emissão real só pode ser testada com uma conta ligada.

## Detalhes técnicos
- A: coluna `claim_id` (nullable, FK) em `invoices`; manter `claims.invoice_id` por compatibilidade. Totais calculados no cliente a partir de `invoices`, `credit_notes` e `payments`.
- B: nova tabela `claim_billing_lines` (claim_id, linha de origem, payer, amount, invoice_id). Índice único por linha/payer faturado para bloquear duplicados. GRANT + RLS por `get_user_shop_ids`.
- C/D/E: tabelas `claim_supplements` e `claim_total_loss`, e colunas de imobilização em `claims`, sempre com GRANT, RLS e só alterações aditivas.
