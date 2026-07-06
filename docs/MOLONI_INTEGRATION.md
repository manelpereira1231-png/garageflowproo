# Integração Moloni — Estado: **totalmente implementada**

O código está pronto. Basta configurar os segredos OAuth uma vez pela plataforma.

## O que já está feito

- Edge functions `moloni-connect`, `moloni-emit`, `moloni-credit-note` implementadas com fluxo real (não são scaffold).
- Refresh automático de token OAuth (Moloni access_token expira em 1h; usamos o refresh_token guardado encriptado com AES-GCM).
- Tabela `integracao_faturacao` estendida com `refresh_token_encrypted`, `token_expires_at`, `moloni_company_id`.
- UI em *Definições → Faturação Certificada* aceita Moloni: email, password, company_id, série (document_set_id) e tipo de documento.
- Página **Detalhes de fatura** deteta o provider ativo (`integracao_faturacao.provider`) e roteia para `moloni-emit` ou `invoicexpress-emit` automaticamente. O mesmo se aplica à emissão de Nota de Crédito.
- Ownership check via `get_user_shop_ids` em todas as edge functions Moloni (mesmo padrão de segurança do InvoiceXpress).

## O que a plataforma ainda tem de fazer (só uma vez)

1. Registar app OAuth em https://www.moloni.pt/api/ (Menu do utilizador → API → Aplicações).
2. Guardar os segredos:
   - `MOLONI_CLIENT_ID`
   - `MOLONI_CLIENT_SECRET`

Enquanto estes segredos não existirem, `moloni-connect` e `moloni-emit` devolvem HTTP 501 com a mensagem `"Moloni não configurado na plataforma"` — o InvoiceXpress continua a funcionar normalmente.

## O que cada oficina faz

1. Vai a *Definições → Faturação Certificada*.
2. Escolhe **Moloni**.
3. Introduz email + password da conta Moloni e o `company_id` (Moloni → Definições → Empresa).
4. Opcionalmente indica a série (`document_set_id`) e o tipo de documento por defeito.
5. Testa a ligação → grava.
6. Nas faturas, o botão passa a ser **"Emitir via Moloni"**.

## Endpoints Moloni utilizados

| Ação | Endpoint |
|---|---|
| Login (password grant) | `POST /v1/grant/?grant_type=password` |
| Refresh token | `POST /v1/grant/?grant_type=refresh_token` |
| Listar empresas (validação) | `POST /v1/companies/getAll/` |
| Procurar cliente por NIF | `POST /v1/customers/getByVat/` |
| Criar cliente | `POST /v1/customers/insert/` |
| Séries de documentos | `POST /v1/documentSets/getAll/` |
| Taxas IVA | `POST /v1/taxes/getAll/` |
| Unidades / Categorias | `POST /v1/measurementUnits/getAll/`, `POST /v1/productCategories/getAll/` |
| Criar produto | `POST /v1/products/insert/` |
| Emitir fatura | `POST /v1/invoices/insert/` (status=1 fecha o documento) |
| Detalhes (ATCUD, número) | `POST /v1/invoices/getOne/` |
| Link PDF certificado | `POST /v1/invoices/getPDFLink/` |
| Nota de crédito | `POST /v1/creditNotes/insert/` (com `associated_documents`) |

## Notas legais

- O SAF-T PT **oficial e certificado** descarrega-se dentro do Moloni (Contabilidade → SAF-T). O botão SAF-T do GarageFlow é sempre informativo.
- ATCUD, QR Code, hash criptográfico e numeração sequencial são gerados pelo Moloni sob a certificação AT nº 0192, não pelo GarageFlow.
- A responsabilidade fiscal é da oficina (é a conta AT dela que emite). O GarageFlow é apenas o front-end.
