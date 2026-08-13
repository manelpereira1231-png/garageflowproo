# GarageFlow — Arnês de teste de carga e concorrência

Estes scripts **não correm sozinhos no ambiente do agente**: exigem credenciais de
utilizadores reais (ou de teste) porque quase todo o ERP está protegido por RLS.
Sem sessão autenticada só é possível medir o caminho anónimo.

## Pré-requisitos

Criar um ficheiro `.env.loadtest` (não committar):

```
SUPABASE_URL=https://<projeto>.supabase.co
SUPABASE_ANON_KEY=<anon key>
# N utilizadores de teste, um por linha: email:password:shop_id
LOAD_USERS_FILE=./users.txt
```

Cada linha de `users.txt` representa uma oficina simulada.

## 1. Rampa de leitura (sem escrita)

```
bun scripts/loadtest/read_ramp.mjs
```

Mede p50/p95/p99, throughput e erros em concorrência 1→400 no caminho
PostgREST → Postgres.

## 2. Carga autenticada mista (dashboard, pesquisa, clientes, veículos, OS)

```
bun scripts/loadtest/auth_mixed.mjs --shops 1000 --minutes 30
```

Cada "oficina" faz login uma vez e depois executa operações aleatórias
representativas. Reporta métricas por tipo de operação.

## 3. Concorrência crítica (escreve dados — usar ambiente de teste)

```
bun scripts/loadtest/concurrency.mjs --work-order <uuid> --quote <uuid> --n 50
```

Testa:
- N chamadas simultâneas a `consume_work_order_parts` na mesma OS/peça
  (esperado: stock decrementado **uma** vez, sem movimentos duplicados);
- N aprovações simultâneas do mesmo orçamento (esperado: 1 aprovação, restantes rejeitadas);
- N conversões simultâneas do mesmo orçamento (esperado: 1 OS criada).

O script imprime o estado final de `parts.stock_quantity`, a contagem de
`stock_movements` e o número de OS criadas — números verificáveis, não estimativas.

## Aviso

Os scripts 2 e 3 **escrevem** na base de dados. Executar apenas contra um
projeto de teste/staging, nunca contra dados reais de clientes.
