# Teste de carga reproduzível — GarageFlow

Objetivo: medir a API (PostgREST + RLS) com N sessões autenticadas em paralelo,
sem tocar em dados de produção (apenas leituras) ou contra um projeto de staging.

## Requisitos
- `k6` (https://k6.io)
- Um ficheiro `users.json` com tokens de sessão de contas de teste:
  `[{"token":"<access_token>","shopId":"<uuid>"}, ...]`
  (gerar com login normal em contas de teste; nunca usar contas reais de clientes)

## Executar

```bash
k6 run -e BASE_URL=https://<projeto>.supabase.co \
       -e ANON_KEY=<anon_key> \
       -e VUS=100 -e DURATION=90s \
       scripts/loadtest/api-load.js
```

## Critérios de aprovação (definidos, ainda não executados a esta escala)
| Métrica | Aprovação |
|---|---|
| erros HTTP | 0% |
| p95 leitura de lista (50 registos) | < 400 ms |
| p99 | < 800 ms |
| ligações Postgres | < 70% do máximo |
| memória do servidor | < 85% sustentado |
| rollbacks | sem crescimento acelerado face ao baseline |

## O que falta para provar "1000 oficinas"
1. Projeto de staging com dados sintéticos: 1000 oficinas × (200 clientes,
   300 viaturas, 500 orçamentos, 500 OS, 300 faturas, 2000 movimentos de stock).
2. 200–400 sessões simultâneas distribuídas por oficinas diferentes (não a mesma).
3. Repetir `EXPLAIN (ANALYZE, BUFFERS)` das listas principais com esse volume.
