# Correção final da Demo e clientes mobile

## Objetivo
- Concluir a ligação do estado reativo já criado para que a barra, identificação, Reset, guia e restantes elementos exclusivos da Demo desapareçam assim que a sessão passe a pertencer a uma conta real.
- Corrigir apenas a apresentação dos cartões de clientes em mobile/iPad durante a Demo: remover a ação de ligar, impedir nomes partidos de forma irregular e alinhar profissionalmente as restantes ações.

## Implementação
1. Ativar uma única vez o isolamento Demo no arranque da aplicação.
2. Fazer `SalesDemoBar` e `DemoGuide` consumirem o estado Demo reativo, evitando informação visual antiga após a troca de conta.
3. Ajustar a grelha mobile dos clientes para reservar espaço estável ao nome e organizar WhatsApp, email, portal, editar e eliminar sem compressão.
4. Ocultar os botões `tel:` apenas nos cartões mobile da Demo; manter dados, contactos e comportamento das contas reais inalterados.

## Validação
- Confirmar Demo ativa e elementos Demo visíveis.
- Confirmar que, ao mudar para uma sessão real, todos os elementos Demo desaparecem imediatamente e após refresh.
- Verificar cartões de clientes da Demo em mobile e iPad, incluindo nomes longos e ações restantes.
- Executar a verificação de tipos e testes visuais direcionados.

## Limites
- Sem alterações a pagamentos, referências, afiliados, permissões, onboarding, dados ou lógica interna da Demo.
- Sem alterações à experiência desktop dos clientes nem aos contactos persistidos.