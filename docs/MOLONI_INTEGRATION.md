# Integração Moloni — Guia de Ativação

Estado atual: **scaffold pronto**, desativado no seletor de `Definições → Faturação Certificada`.
As edge functions `moloni-connect` e `moloni-emit` já existem e replicam o padrão de `invoicexpress-*`, mas devolvem HTTP 501 até os segredos OAuth serem configurados.

## Porquê Moloni?

Moloni é software certificado pela AT (nº 0192). Emite FT, FR, NC, ND com ATCUD, QR Code e hash. API OAuth2 pública.

## Passos para ativar (uma vez, pela plataforma)

1. Criar app OAuth em https://www.moloni.pt/api/ (Definições → API).
2. Guardar segredos na plataforma:
   - `MOLONI_CLIENT_ID`
   - `MOLONI_CLIENT_SECRET`
3. Adicionar coluna `refresh_token_encrypted TEXT NULL` à tabela `integracao_faturacao` (Moloni tokens expiram em 1h e exigem refresh):
   ```sql
   ALTER TABLE public.integracao_faturacao
     ADD COLUMN IF NOT EXISTS refresh_token_encrypted TEXT;
   ```
4. Implementar o TODO no ficheiro `supabase/functions/moloni-emit/index.ts`:
   - Desencriptar access_token; se expirou (guardar `token_expires_at`), usar refresh_token via `POST /v1/grant/?grant_type=refresh_token`.
   - `POST /v1/invoices/insert/?access_token=...` com payload:
     ```json
     {
       "company_id": <int>,
       "customer_id": <int>,               // criar via /customers/insert/ se não existir
       "document_set_id": <int>,           // série da oficina
       "date": "YYYY-MM-DD",
       "expiration_date": "YYYY-MM-DD",
       "products": [
         { "product_id": <int>, "name": "...", "qty": 1, "price": 100, "taxes": [{ "tax_id": <int> }] }
       ],
       "payments": [ ... ],
       "status": 1                          // 1 = fechado/emitido
     }
     ```
   - `POST /v1/invoices/getPDFLink/` para obter o link do PDF certificado.
   - Guardar em `invoices`:
     ```ts
     await admin.from("invoices").update({
       provider_invoice_id: String(response.document_id),
       provider_pdf_url: pdf_url,
       atcud: response.atcud,
       number: response.number,
     }).eq("id", invoice_id);
     ```
5. Ativar a opção Moloni no seletor:
   ```tsx
   // src/pages/settings/BillingIntegration.tsx
   <SelectItem value="moloni">Moloni</SelectItem>   // remove disabled
   ```
6. No handler `invoke` do BillingIntegration.tsx, adicionar branch:
   ```ts
   const fn = provider === "moloni" ? "moloni-connect" : "invoicexpress-connect";
   await supabase.functions.invoke(fn, { body: {...} });
   ```

## Endpoints úteis Moloni

| Ação | Endpoint |
|---|---|
| Obter token | `POST /v1/grant/?grant_type=password` |
| Refresh token | `POST /v1/grant/?grant_type=refresh_token` |
| Listar empresas | `POST /v1/companies/getAll/` |
| Listar séries | `POST /v1/documentSets/getAll/` |
| Inserir cliente | `POST /v1/customers/insert/` |
| Inserir produto | `POST /v1/products/insert/` |
| Inserir fatura | `POST /v1/invoices/insert/` |
| Obter PDF | `POST /v1/invoices/getPDFLink/` |
| Nota de crédito | `POST /v1/creditNotes/insert/` |

## Notas

- Moloni cobra por empresa; a integração é por oficina (multi-tenant como InvoiceXpress).
- O SAF-T certificado é gerado dentro da Moloni (`Contabilidade → SAF-T`) — o botão SAF-T do GarageFlow continua a ser apenas informativo.
- Escolher **InvoiceXpress** para oficinas que querem API key simples; **Moloni** para oficinas que já usam Moloni e querem manter o fluxo lá.
