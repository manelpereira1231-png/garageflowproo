
# Plano: Serviços vs Modo Oficina + Parte Legal 100% blindada

Vou fazer as duas coisas em paralelo. Recomendo aplicar **as 4 medidas legais** — cada uma tapa um buraco diferente e juntas deixam o sistema totalmente defensável perante a AT e perante o cliente da oficina.

---

## 1. Separar Serviços vs Modo Oficina

Hoje sobrepõem-se. Depois desta mudança cada um tem um papel único e claro.

### Serviços (`/services`) — Gestão administrativa
Para o **dono / rececionista / gestor**, no PC.
- Lista de todas as ordens de trabalho (abertas, concluídas, entregues, canceladas).
- Filtros: estado, cliente, viatura, técnico, período, valor.
- Ações: criar OS, converter orçamento→OS, editar dados administrativos, **emitir fatura certificada**, imprimir, arquivar, exportar CSV.
- Colunas: nº, cliente, viatura, técnico, estado, total, lucro, data.
- Sem timer, sem checklist mecânico — é a "secretária".

### Modo Oficina (`/workshop`) — Execução no terreno
Para o **mecânico**, no tablet/telemóvel na bancada. Interface grande, mãos sujas.
- **Kanban vertical mobile** com 4 colunas: A fazer / Em diagnóstico / Em execução / Pronta a entregar.
- Cada cartão OS abre em ecrã cheio com:
  - Timer grande de mão‑de‑obra (start/pause/stop, guarda em `work_order_times`).
  - Checklist de inspeção (`inspection_checklists`) com toque grande.
  - Botões enormes para **fotos** (antes / durante / depois) e **áudio de diagnóstico**.
  - Assinatura digital do cliente na entrega.
  - Peças usadas → decremento automático de stock.
  - Botão único "Concluir" que muda estado e notifica o rececionista.
- Sem preços editáveis, sem faturação, sem CSV — é a "bancada".

Link cruzado: cada OS em Serviços tem "Abrir no Modo Oficina" e vice‑versa.

---

## 2. Parte legal — as 4 medidas, todas

### 2.1 Botão "Emitir fatura certificada" com estado visível
- Faturas ganham coluna de estado: **Rascunho** (cinza) / **Certificada** (verde, com ATCUD/QR/série InvoiceXpress) / **Anulada** (vermelho, com nº da Nota de Crédito).
- Em `Services` (ao concluir OS) e em `InvoiceDetail` aparece o botão único **"Emitir fatura certificada"** → chama edge function `invoicexpress-emit` → guarda `atcud`, `qr_code`, `series`, `certified_pdf_url`, `invoicexpress_id` na tabela `invoices`.
- Badge visível em qualquer listagem (Faturas, Serviços, Dashboard).

### 2.2 Bloqueio de edição pós‑certificação + Nota de Crédito obrigatória
- Trigger SQL: `invoices` com `status='certified'` bloqueia UPDATE em campos fiscais (linhas, totais, NIF, datas).
- Botão "Editar" desaparece; aparece **"Anular via Nota de Crédito"** → chama `invoicexpress-credit-note`, gera NC certificada, muda estado da fatura para "anulada" e liga as duas por `credit_note_id`.
- Impede violação do artigo 36º do CIVA (imutabilidade de documento fiscal).

### 2.3 Aviso em TODOS os PDFs internos
Já existe em faturas, alargar a **orçamentos, ordens de trabalho, relatórios de inspeção, recibos internos** — rodapé fixo:
> "Documento sem valor fiscal — não certificado pela AT. Para fatura legalmente válida, emita através da integração de faturação certificada."
- Se a oficina tiver InvoiceXpress ligado e o documento **for** certificado, o aviso desaparece e é substituído por "Documento certificado — ATCUD: XXX-YY / Série: ZZZ".

### 2.4 Painel de Conformidade (Definições → Faturação)
Substitui a página atual por dashboard vivo:
- ✅/❌ **InvoiceXpress ligado** (mostra conta, série ativa, expiração da API key).
- 📊 **Documentos deste mês**: X certificados, Y rascunhos, Z anulados via NC.
- 📥 **Último SAF-T PT** descarregado do painel InvoiceXpress (link direto + data).
- ⚠️ **Alertas**: NIF em falta em clientes, série a esgotar, credencial inválida.
- 📚 Guia "Como validar no e-Fatura" com 3 passos.

---

## Ficheiros afetados (resumo técnico)

```text
Novos:
  supabase/migrations/…_invoice_legal_lock.sql      (trigger imutabilidade + colunas status/atcud/qr)
  supabase/functions/invoicexpress-credit-note/     (já existe, garantir wiring)
  src/pages/workshop/WorkshopBoard.tsx              (Kanban mobile-first)
  src/pages/workshop/WorkOrderExecution.tsx         (execução: timer + checklist + fotos)
  src/components/CertifiedBadge.tsx                 (badge reutilizável)
  src/components/UncertifiedFooter.tsx              (rodapé PDF condicional)
  src/pages/settings/BillingCompliance.tsx          (painel conformidade)

Alterados:
  src/pages/Services.tsx                            (só gestão + botão emitir fatura)
  src/pages/Workshop.tsx                            (redirecionar para novo board)
  src/pages/Invoices.tsx + InvoiceDetail.tsx        (estado visível, bloqueio edição, NC)
  src/pages/Quotes.tsx + QuoteForm.tsx              (rodapé "não certificado")
  src/lib/pdfGenerator.ts + invoicePdfGenerator.ts  (rodapé condicional)
  src/pages/settings/BillingIntegration.tsx         (redireciona para BillingCompliance)
  src/App.tsx                                       (rotas /workshop/board, /workshop/os/:id)
```

Nenhuma alteração no domínio Market. Nada mexe fora do ERP.

---

Aprovas o plano completo? Se sim começo já pela migração de bloqueio legal (é a base) e depois faço o resto em paralelo.
