# Auditoria — logótipo e próximas revisões

Data: 23 de outubro de 2026. Âmbito: ERP, sem alterações ao Market, faturação, preços ou dados de clientes reais.

## Estado inicial (auditado antes da implementação)

| Funcionalidade | Estado inicial | Evidência concreta | Problema | Correção necessária |
|---|---|---|---|---|
| Seleção do logótipo | Parcialmente implementada | Settings e OnboardingWizard validam 2 MB e criam preview local | Não validam formatos; preview não significa persistência | Validar PNG/JPEG/WebP/GIF e distinguir preview da imagem persistida |
| Upload e gravação | Parcialmente implementada | Settings ignora upErr; onboarding devolve null no erro | Pode apresentar sucesso sem guardar imagem; update sem retorno não confirma linha alterada | Abortar no erro, verificar retorno e leitura da referência |
| Cache da imagem | Parcialmente implementada | Ambos sobrescrevem shop-logos/{shopId}/logo.ext | URL não muda, imagem anterior pode continuar em cache | Ficheiro imutável por upload, nova URL persistida; manter antigos |
| Identidade visual reativa | Parcialmente implementada | useWhiteLabel lê localStorage apenas ao montar; useOwnedShops tem cache 60 s | Pode conservar identidade antiga ou de outra oficina | Atualizar através do evento existente e ignorar respostas antigas |
| Armazenamento | Implementada | Bucket shop-logos público, escrita por pasta de oficinas autorizadas | Leitura pública apropriada para identidade; não é documento privado | Manter políticas e bucket; não apagar referências antigas |
| Gravação da revisão | Parcialmente implementada | Services.completeWithReminder insere service_reminders; ignora error | Sucesso falso; índice único pending por veículo/tipo pode rejeitar insert; só política restrictive presente | Gravação protegida e atómica, retorno confirmado, preservar permissões |
| Associação | Implementada | service_reminders: shop_id, vehicle_id, client_id, work_order_id | FKs individuais não garantem coerência entre oficinas | Validar todas as relações no servidor |
| Data/km persistentes | Implementada no modelo, acesso operacional incompleto | date/integer, 17 registos pending; índice único existente | Policy permissive ausente impede acesso normal apesar dos grants | Restabelecer acesso com as capacidades já exigidas |
| Sem revisão/fechar diálogo | Implementada | Botão sem lembrete conclui; fechar não conclui; data sugerida +6 meses | Falhas da revisão ignoradas | Manter conclusão independente e informar falhas; não inventar data por defeito |
| Processo automático | Parcialmente implementada | check-service-reminders-daily ativo 08:00 UTC; execuções SQL recentes succeeded | HTTP aceite não prova entrega; worker apenas 7 dias e notified_at único | Reutilizar o mesmo job com processamento SQL transacional verificável |
| Marcos 14/7/1 dias | Inexistente | check-reminders filtra <=7 e notified_at null | Um único alerta, sem vários marcos | Marcos centralizados, idempotência e isolamento |
| Notificações da oficina | Parcialmente implementada | check-reminders escreve alerts (não notifications) | Não aparecem necessariamente no sininho; concorrência pode duplicar | Reutilizar centro notifications, ligação ao veículo |
| Portal do cliente | Inexistente para revisões | get_client_portal_data não retorna revisões; ClientPortal não as lê | Cliente não vê a data/km nem avisos | Acrescentar ao portal existente e às suas viaturas |
| Acesso ao portal | Implementado por token, não por conta de cliente | /portal/:token e RPC SECURITY DEFINER por clients.portal_token | Não foi encontrado vínculo seguro conta autenticada → clients | Preservar acesso por link secreto existente; não associar por email automaticamente |
| Email/push de revisão | Inexistente no worker | check-reminders apenas cria alerts; smart-reminders não envia email | Infraestrutura genérica não prova entrega desta funcionalidade | Priorizar notificações persistidas no portal; não declarar emails enviados |
| Oficina: revisão visível | Parcialmente implementada | VehiclePassport lê e apresenta pending | Sem edição/cancelamento; acesso bloqueado pela política ausente | Reutilizar esta área, permitir alterar/cancelar segundo permissões |
| Alteração/cancelamento/reabertura | Inexistente no ciclo do lembrete | Sem triggers no service_reminders | Avisos antigos não invalidados | Invalidar avisos e marcos quando data/km/estado muda; cancelar ao reabrir serviço |
| Quilometragem | Apenas armazenada no worker de datas | vehicles.mileage e work_orders.entry_mileage existem; worker não compara | smart-reminders usa heurística modulo, não monitorização real | Comparar apenas quilometragem registada com alvo; aviso único |
| PT/BR/fuso | Parcialmente implementada | UI traduzida; worker usa Date UTC e texto PT fixo | Datas locais e texto BR inconsistentes | Data local de shops.timezone e textos distintos PT/BR |

## Risco e compatibilidade da alteração de dados

Alterações aditivas: metadados de processamento na tabela de revisões existente, funções protegidas, validação de relações, índice de deduplicação apenas para novas notificações de revisão e política que impede avisos de cliente de serem lidos como avisos da oficina. Reutilizar o job diário; não criar outro agendamento. Não apagar dados antigos nem ficheiros. Nenhuma operação destrutiva. O job diário pode levar até 24 horas a processar uma revisão criada após a execução; não são enviados marcos já passados. A associação a uma conta autenticada de cliente exige um modelo de conta que o portal atual não possui e não será inventada.

## Testes e estado final

Verificação de 26 de outubro de 2026:

- Portal real da Oficina Henriques: imagem carregada no cabeçalho e rodapé, sem filtros que a tornem invisível; nova leitura após recarregar confirmada. Vistas 1280 px e 390 px verificadas, sem transbordamento horizontal. O ficheiro guardado por esta oficina é uma imagem vertical; não foi substituído nem recortado.
- Oficina isolada de teste `dd`: upload real pelo helper da aplicação, caminho imutável, atualização e confirmação de leitura; nova sessão pública mostrou o mesmo logótipo. Revisão gravada pela RPC autenticada com data 09/11/2026 e 120 000 km, visível no portal numa sessão nova. Registos temporários removidos e logótipo anterior (vazio) restaurado; nenhum cliente real alterado.
- 17 testes automáticos aprovados: validação de imagem, marcos 14/7/1, ausência de valores inventados, data local da oficina, aviso confirmado de quilometragem e passaporte PT/BR/ES. Corrigido o ambiente dos testes do passaporte para os hooks novos.
- Teste SQL transacional executado com rollback: marcos 14/7/1, datas fora dos marcos/passadas, limiar de km real, segunda execução sem duplicações, token inválido, isolamento entre clientes/oficinas, alteração de data, cancelamento e reabertura da OS. As asserções levantam erro se falharem; execução devolvida sem erro. Confirmado zero registos temporários após rollback.
- Falha corrigida: conclusão com revisão apenas por km ignorava a gravação; processor agora compara a quilometragem efetivamente registada, guarda aviso único e apresenta o mesmo aviso no portal. Cancelamento/alteração invalidam também o marco de km.
- Job diário existente ativo às 08:00 UTC, última execução SQL observada em 26/10 com estado succeeded. `check-reminders` atualizado e colocado no servidor; não foi criado outro job. Isto não comprova uma futura execução HTTP do job, que só acontece no horário seguinte.
- Compilação automática sem erros. Não foram enviados emails ou push durante os testes; os avisos implementados são persistidos para oficina e portal, não uma promessa de entrega por canais externos.

Limitações: a oficina de teste tem avaliação expirada. Não se alterou a subscrição para ultrapassar essa restrição; upload pelo seletor de Definições e edição através da ficha da viatura não foram validados ponta a ponta nesta conta. Foram validados a gravação autenticada real e a leitura no portal. As alterações visuais continuam a precisar de publicação.