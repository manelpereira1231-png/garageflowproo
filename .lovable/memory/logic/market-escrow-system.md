---
name: market-escrow-system
description: Stripe Escrow lifecycle for vehicle sales — manual capture, 48h satisfaction window, cron auto-capture, Connect splits
type: feature
---
GarageFlow Market usa Stripe Escrow real para vendas de veículos. Lifecycle:

1. **Checkout** (`market-escrow-checkout`): cria PaymentIntent com `capture_method: "manual"` (autoriza, não captura). Se vendedor tem Connect ativo, usa `transfer_data.destination` + `application_fee_amount` (split automático).
2. **Pagamento autorizado** → status `paid` (fundos bloqueados no cartão do comprador, ainda não cobrados).
3. **Janela de satisfação 48h** começa em `created_at` (ou `delivery_confirmed_at` se entrega marcada). Comprador pode:
   - **Confirmar entrega** (`market-escrow-confirm-delivery`): captura imediata + liberta para vendedor.
   - **Cancelar com reembolso** (`market-satisfaction-cancel`): cancela o PI, sem cobrança.
4. **Após 48h sem ação**: cron `market-escrow-cron-capture` (corre de hora a hora via pg_cron) captura automaticamente. Marca `status='released'`, `captured_at`, `released_at`.

Edge functions:
- `connect-onboarding`, `connect-status` — Stripe Connect Express para sellers + shops
- `market-escrow-checkout` — autoriza com manual capture
- `market-escrow-confirm-delivery` — comprador confirma → captura imediata
- `market-escrow-cron-capture` — cron 48h fallback automático
- `market-satisfaction-cancel` — cancela dentro da janela
- `market-escrow-resume` — retoma sessão pendente

Statuses do `market_escrow`:
`pending_payment` → `paid` (autorizado) → [`delivery_confirmed`] → `released` (capturado) | `cancelled` | `refunded` | `disputed`

Componente UI: `<MarketSatisfactionWindow>` mostra countdown 48h, botão "Confirmar entrega (libertar agora)" + "Cancelar com reembolso".
