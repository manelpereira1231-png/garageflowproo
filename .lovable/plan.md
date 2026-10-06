# Novo desenho dos Sinistros: plano de alterações à base de dados (para aprovar)

Objetivo: passar de "preencher formulários" para "fotografar documentos e registar só o essencial", sem apagar nada e sem estragar Portugal nem o Brasil.

## Regra base: reaproveitar o que já existe

Várias partes do pedido já existem desde as fases A a E. Não vão ser criadas de novo:

| Pedido | O que já existe | O que muda |
|---|---|---|
| tabela `claim_documents` | já existe, com categoria e ficheiro guardado | só passam a existir as categorias novas (Declaração Amigável, Relatório de peritagem, Autorização, Danos, Danos ocultos, Fatura, Outros); as categorias antigas continuam válidas |
| tabela `claim_authorizations` | `claim_supplements` (adicionais, Fase C) | **acrescentar** a `claim_supplements`: `type` (inicial ou adicional), `number`, `quote_id`, estado `no_perito` e `decided_by`. Não é criada uma segunda tabela |
| faturar à seguradora e ao cliente | `claim_billing_lines` (Fase B) e a ligação entre faturas e sinistro (Fase A) | os dois cartões novos usam este sistema; o "a quem se fatura" é a escolha de quem paga, que já existe |
| perda total, decisão e encargos | colunas da Fase D | acrescentar só `outcome`, `storage_daily_rate` e `disassembly_fee`; as decisões do cliente ficam mapeadas para as 3 opções novas |
| imobilização | `vehicle_in_date` (Fase E) | é usada como "data de entrada"; acrescentar a viatura de substituição (quem a cedeu, início e fim) |
| cliente informado | registo da Fase E | acrescentar o interruptor "Automático" |

## Campos e tabelas novos (só acrescentar, nada apagado)

1. `claims`: `outcome` (reparação ou perda total), `has_daaa`, `requires_disassembly`, `replacement_vehicle`, `replacement_start`, `replacement_end`, `storage_daily_rate`, `disassembly_fee`, `auto_notify_client`, `phase_override` (para "corrigir estado manualmente") e datas dos acontecimentos dos prazos (participação, primeiro contacto, peritagem concluída, relatório, responsabilidade assumida).
2. `claim_supplements`: as colunas da tabela acima.
3. Linhas de orçamento e de ordem de serviço: `covered_by_insurance`, ligado por defeito, para separar os extras.
4. Nova tabela `claim_share_links` (sinistro, token aleatório, cliente ou perito, validade). Protegida: só a oficina lhe acede; as páginas públicas leem os dados através de uma função no servidor que confirma o token.
5. Nova tabela de preferências da oficina para o preço diário de parqueamento, ou uma coluna nova nas definições da oficina, conforme o que lá existir.

## Estados: os 19 antigos passam para 6 fases

A coluna de estado atual **não muda**. A fase é calculada a partir dela, seguindo exatamente o mapeamento pedido. "A aguardar peças" e "Cancelado" aparecem como etiqueta. Os sinistros existentes abrem como sempre.

## Portugal e Brasil

- **Prazos legais (DL 291/2007, dias úteis e feriados portugueses):** só em oficinas de Portugal. No Brasil o cartão não aparece, porque esta lei não se aplica e não vou inventar prazos.
- **Termos e moeda:** em Portugal "Fatura", InvoiceXpress e €; no Brasil "Nota fiscal", eNotas, R$, "veículo" e datas brasileiras. O pedido fala só em português de Portugal; no Brasil mantém-se a terminologia brasileira que já existe.
- **Nota do pagamento em 8 dias úteis:** só em Portugal.

## Ordem de execução (uma etapa de cada vez, testando no ecrã com a oficina "dd" e um sinistro temporário apagado no fim)

1. Alterações à base de dados acima.
2. Nova página de detalhe: cabeçalho, barra de fases, Documentos com câmara, "O essencial" com "Mais detalhes (opcional)"; histórico e comunicações numa gaveta lateral.
3. Orçamento e autorizações (com adicionais) e os dois cartões de faturação.
4. Prazos da seguradora (só em Portugal), mais o contador e os alertas.
5. Perda total e imobilização com viatura de substituição.
6. Página pública `/acompanhar/:token`, mensagens por email e link de WhatsApp.
7. Página do perito `/perito/:token`, com uma função no servidor que valida o token.
8. Lista `/claims` (6 fases, contador "Prazos em atraso", coluna "Próximo passo"), "Novo sinistro" simplificado e o cartão de sinistros no Dashboard.

## Limites conhecidos

- O email ao perito e ao cliente usa o envio de email que o GarageFlow já tem. Se não estiver configurado numa oficina, aparece só o link para copiar e o botão de WhatsApp.
- A emissão real das faturas continua a depender de haver uma conta InvoiceXpress (Portugal) ou eNotas (Brasil) ligada.
- O SMS fica preparado, mas não ligado.
