# SLOs — GarageFlow

| Serviço | Métrica | Alvo | Janela | Fonte |
|---|---|---|---|---|
| API Edge | Disponibilidade (2xx+3xx) | 99.5% | mensal | `api_logs` |
| API Edge | p95 latência | < 800 ms | semanal | `api_logs.duration_ms` |
| API Edge | Taxa 5xx | < 1% | diária | `api_logs` |
| Web app | Disponibilidade (status page) | 99.9% | mensal | `/status` checks |
| Worker action queue | Backlog < 100 | 99% das horas | semanal | `action_queue` |
| Reclamações P1 | TTR < 4h | 95% | mensal | `complaints` |
| Webhook Stripe | Sucesso | 99.9% | mensal | `stripe_webhook_events` |

**Error budget:** 0.5% mensal API. Esgotado → freeze de deploys não-críticos e foco em fiabilidade.

**Revisão:** trimestral. Alvos só baixam com aprovação de super admin.
