# Sinistros — página única conforme o documento

## Objetivo
Aplicar o formato enviado aos Sinistros, sem recriar o módulo: fotografar documentos e registar apenas o essencial. Os campos antigos, dados e funcionalidades continuam disponíveis. A página principal deixa de ter os seis separadores.

## Apresentação
- **Cabeçalho:** número, estado, viatura, matrícula, cliente, seguradora e processo; ações «Enviar pacote ao perito», «Ver o que o cliente vê» e histórico numa gaveta lateral.
- **Onde está o processo:** seletor Reparar / Perda total, seis fases, datas disponíveis e próximo passo calculado. Correção manual apenas no menu «⋯», com histórico.
- **Coluna principal:** Documentos → Orçamento e autorizações → Faturação dividida. Em perda total, os dois últimos são substituídos por Perda total e encargos.
- **Coluna lateral (~340px):** O essencial → Prazos da seguradora → Imobilização → Cliente informado. Manter esta ordem, sem deslocar os cartões laterais para a coluna principal.
- **O essencial:** seguradora, número do processo, franquia, nome/contacto do perito. Viatura de substituição em Imobilização. Campos antigos em «Mais detalhes (opcional)», fechado inicialmente.
- **Visual:** fundo #F3F4F6, cartões brancos com borda cinzenta e cantos ~14px, ação principal #F59E0B com texto #111827; manter a barra lateral existente. Usar as cores das fases indicadas no documento através dos estilos partilhados dos Sinistros, sem mudar o tema das restantes páginas.
- **Telemóvel:** colunas empilhadas, fases numa grelha legível, botões com pelo menos 44px, textos completos sem sobreposições ou deslocamento horizontal da página.

## Reutilizar e completar
1. Reintegrar na página os recursos já existentes de documentos, autorizações/adicionais, faturação dividida, perda total, prazos, imobilização e cliente informado.
2. Documentos privados: fotografia/câmara, galeria e PDF; categorias, miniaturas e visualização ampliada. Conservar anexos antigos.
3. Autorizações: pedido inicial e adicionais, valores pedidos/autorizados, estados, fotografias e total calculado; reutilizar os registos existentes, sem duplicação.
4. Faturação: seguradora = autorizado − franquia; cliente = franquia + extras não cobertos. Reutilizar a emissão atual, as ligações ao sinistro e os bloqueios das linhas faturadas; não alterar os fornecedores fiscais ou Stripe.
5. Perda total: decisão do cliente, desmontagem, parqueamento e destinatário dos encargos, preservando os valores já registados.
6. Links do cliente/perito: verificar os recursos existentes antes de os voltar a expor. O perito recebe apenas o pedido e documentos autorizados; link válido 14 dias; decisão, relatório e histórico sincronizados. Não mostrar sucesso de envio se o email não for efetivamente enviado.
7. Estados: combinar eventos reais, autorizações, OS e faturas/pagamentos, respeitando o mapeamento dos estados antigos. Não alterar em massa os sinistros existentes nem assumir fases concluídas sem evidência.
8. Lista: seis contadores por fase, mais prazos em atraso em Portugal, próximo passo e criação simplificada (cliente, viatura, seguradora e fotografias opcionais).
9. Conferir o contador/alerta de prazos existente e a comunicação automática por mudança de fase; completar apenas o que faltar e evitar mensagens duplicadas.

## Plano das migrações e detalhes técnicos
**Confirmado na base de dados:** já existem `claim_documents`, `claim_share_links`, `claim_supplements` (incluindo tipo, número, orçamento e decisão), `claim_billing_lines` e os campos v2 em `claims`.

- **Não criar `claim_authorizations`:** as autorizações iniciais/adicionais usam `claim_supplements`, já existente; não renomear nem duplicar os dados.
- **Não recriar documentos ou links:** conservar tabelas, ficheiros e tokens existentes.
- **Não apagar, renomear nem mudar tipos de colunas.** Os campos antigos apenas ficam recolhidos na apresentação.
- **Primeira etapa sem migrações:** reorganizar a página com os recursos existentes e verificar as lacunas funcionais.
- Se faltar persistência para um requisito, adicionar apenas campos opcionais/com valor por defeito ou funções/transições específicas dos Sinistros. Qualquer ajuste deve respeitar `shop_id`, as permissões existentes e os acessos por token; nenhuma tabela fica aberta a visitantes.
- Campos de cobertura das linhas devem reutilizar o formato existente das linhas de orçamento/OS, evitando criar um segundo modelo.
- Prazos legais portugueses só em oficinas PT, com dias úteis e feriados nacionais/móveis. BR mantém idioma, moeda e fiscalidade brasileiros, sem aplicar legislação portuguesa.

## Verificação antes de concluir
- Testes de cálculos, estados, dias úteis/feriados e isolamento dos links.
- Abrir sinistro existente e testar lista, criação, detalhes opcionais, anexos, adicionais, perda total, histórico e links no computador e telemóvel, incluindo largura de 430px.
- Guardar e reabrir para confirmar persistência; verificar atualização entre técnico/proprietário.
- Validar PT e BR separadamente, sem editar dados reais para demonstrar resultados.
- Emissão fiscal real e emails externos apenas com integração configurada e autorização para ações reais; reportar explicitamente o que não pôde ser testado.

## Limites
Alterar apenas os Sinistros e os pontos diretamente ligados aos seus prazos/alertas. Não redesenhar nem alterar Stripe, autenticação, planos, onboarding, demo, Market, importações ou os módulos fiscais PT/BR.

**A aprovação deste plano precede qualquer alteração à aplicação ou aos dados.**