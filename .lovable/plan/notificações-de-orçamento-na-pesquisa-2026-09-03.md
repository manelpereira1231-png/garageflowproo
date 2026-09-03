# Notificações de orçamento na pesquisa

## Alterações
- Alterar as notificações de orçamento, tanto no sino superior como na página Notificações, para abrirem `/quotes?search=<número do orçamento>` usando `data.quote_number`.
- Fazer a página Orçamentos ler o parâmetro `search` e preencher automaticamente a barra de pesquisa, mostrando o orçamento correspondente.
- Atualizar o trigger que cria notificações futuras e corrigir os links das notificações de orçamento já existentes.
- Manter inalteradas as notificações de pagamentos e outros eventos.

## Validação
- Confirmar typecheck.
- Confirmar no browser que clicar numa notificação de orçamento abre a listagem de Orçamentos, preenche a pesquisa e não abre `/quotes/edit/:id`.
