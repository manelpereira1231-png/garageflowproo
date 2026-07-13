## Objetivo
Adicionar ordenação, filtros, sticky header e paginação a todas as tabelas principais do ERP, reutilizando componentes e sem tocar em base de dados/APIs.

## Estratégia
Criar um conjunto de utilitários e hooks reutilizáveis (client-side) e integrá-los nas 5 páginas: Serviços, Orçamentos, Faturas, Clientes, Veículos.

### Novos ficheiros (reutilizáveis)
- `src/components/table/SortableHeader.tsx` — `<th>` clicável com ícone ↑ ↓ (Lucide `ArrowUp/ArrowDown/ArrowUpDown`), 3 estados (asc / desc / none).
- `src/components/table/TableFilters.tsx` — barra de filtros compacta (search global + selects contextuais + date range + botão "Limpar filtros").
- `src/components/table/TablePagination.tsx` — paginação 50/pág com "Anterior / Seguinte / Página X de Y" + total de resultados.
- `src/hooks/useTableState.ts` — hook que gere `sort`, `filters`, `page` em memória (sessão via `sessionStorage` por chave — ex: `table:services`), com helpers `applySort`, `applyFilters`, `paginate`.
- CSS: adicionar classe utilitária `.sticky-thead` em `src/index.css` (`thead { position: sticky; top: 0; z-index: 10; background: hsl(var(--card)); }`) e aplicar em `<table>` das listas.

### Integração por página
Cada página passa a fetch **todos** os registos do shop (ou range razoável — mantendo a query atual) → `useTableState` filtra/ordena/pagina em cliente:

1. **Serviços** (`Services.tsx`) — ordenáveis: Nº, Data, Cliente, Veículo, Estado, Total. Filtros: search, estado, cliente, data, funcionário.
2. **Orçamentos** (`Quotes.tsx`) — ordenáveis: Nº, Data, Cliente, Veículo, Estado, Total. Filtros: search, estado, cliente, data.
3. **Faturas** (`Invoices.tsx`) — ordenáveis: Nº, Data emissão, Cliente, Estado pagamento, Total. Filtros: search, estado, cliente, data, valor min/max.
4. **Clientes** (`Clients.tsx`) — ordenáveis: Nome, Email, Nº veículos, Criado em. Filtros: search (nome/email/tel/NIF).
5. **Veículos** (`Vehicles.tsx`) — ordenáveis: Matrícula, Marca, Modelo, Ano, Cliente. Filtros: search, marca, cliente.

### Comportamento
- Estado persiste em `sessionStorage` (não localStorage) → sobrevive a refresh na sessão, limpa ao fechar aba.
- Filtros combinam-se com AND. Botão "Limpar filtros" repõe tudo.
- Sticky header via CSS puro nas tabelas existentes.
- Paginação: 50 por página, com "1–50 de 237". Filtros resetam para página 1.
- Ícones de ordenação: `ArrowUpDown` (neutro), `ArrowUp` (asc), `ArrowDown` (desc).

### Não fazer
- Não alterar Supabase / RLS / edge functions.
- Não criar páginas novas.
- Não mexer em auth nem em layout de largura (já corrigido).
- Não tocar nas vistas mobile de cards — apenas nas tabelas desktop (`hidden sm:table`).

### Ordem de execução
1. Criar hook + 3 componentes reutilizáveis + CSS sticky.
2. Aplicar em Services (referência), validar visualmente.
3. Replicar em Quotes, Invoices, Clients, Vehicles.

## Confirmação
Confirmas para avançar com este plano exato? Ou queres ajustar algum ponto (ex: page size, persistência em URL em vez de sessionStorage, filtros específicos)?