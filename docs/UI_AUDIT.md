# UI/UX & Responsiveness Audit — GarageFlow

## Automated scan
- 19 rotas públicas × 3 viewports (375 / 768 / 1440) = **57 verificações**
- **0** casos de overflow horizontal (>2px)
- **0** páginas com >3 botões só-ícone sem `aria-label`

Rotas autenticadas não foram testadas via Playwright (sessão indisponível na sandbox), mas as correções globais abaixo aplicam-se a toda a app.

## Correções globais aplicadas

### Fundações
- `html, body, #root { overflow-x: hidden; max-width: 100vw }` (já existia; validado).
- `img, svg, video, canvas, iframe { max-width: 100% }` (safety net).
- Long strings: `word-wrap: break-word; overflow-wrap: anywhere`.
- Tap targets ≥ 44 px em mobile via `min-h-11` nos icon-buttons de layouts.

### Utilitário canónico `.page-shell`
`max-width: 1536px; mx-auto; w-100%` — usado em todos os layouts. Em ecrãs 4K deixa de esticar texto; em laptops normais mantém 100 % da largura útil.

### Layouts (`Layout`, `MarketLayout`, `AdminLayout`, `CommercialLayout`)
- `<main>` ganha `overflow-x-hidden` explícito.
- Conteúdo envolvido em `.page-shell`.
- Botões só-ícone do header (menu, logout, fechar sidebar, notificações) receberam `aria-label` e altura mínima 44 px.

### shadcn Dialog
- `DialogContent`: `w-[calc(100%-1.5rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-6 rounded-lg`.
- Close button: `aria-label="Fechar"` + área de toque ≥ 44 px em `[role="dialog"]` no mobile.

### Auto-fix de acessibilidade
Script varreu todos os componentes fora de `src/components/ui/` e adicionou `aria-label` a `<Button size="icon">` que tinham `title=`. 4 ficheiros atualizados:
- `src/pages/Services.tsx`
- `src/pages/admin/AdminMarketingAutopilot.tsx`
- `src/pages/admin/AdminMarketListings.tsx`
- `src/components/ShopSwitcher.tsx`

## Ripple de impacto
Estas alterações — sem tocar em cada página — corrigem, para toda a app:
1. Modais recortados em telemóvel (agora fazem scroll interno).
2. Padding excessivo de modais no mobile.
3. Botão fechar do modal sem acessibilidade.
4. Text stretching em monitores 4K/ultrawide.
5. Overflow horizontal acidental por conteúdo dos filhos do `<main>`.
6. Tap targets pequenos nos headers móveis.

## Notas
- Rotas autenticadas passam pelos mesmos layouts, portanto herdam as fundações.
- Redesign visual (paleta, fontes, motion) mantém-se fora do escopo desta auditoria — identidade dark industrial + amber preservada.
- Trabalho página-a-página (revisão de cada formulário/tabela) fica como próxima passagem quando forem detetados casos específicos.
