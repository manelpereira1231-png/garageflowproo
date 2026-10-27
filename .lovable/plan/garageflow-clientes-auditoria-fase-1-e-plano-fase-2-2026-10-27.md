# GarageFlow Clientes — Auditoria (Fase 1) e Plano (Fase 2)

## Auditoria (confirmada no código)
- **Portal:** página única `/portal/:token` (ClientPortal). Todos os dados vêm de funções do servidor que recebem o token: `get_client_portal_data`, `get_client_portal_reminders`, `portal_respond_to_quote`, `portal_prepare_invoice_payment`. Não há login de cliente.
- **Links:** token = UUID aleatório em `clients.portal_token`. Permanente (sem validade). A oficina copia o link no botão "Portal" da lista de Clientes; se o cliente antigo não tiver token, é gerado nessa altura.
- **Isolamento:** o servidor só devolve dados do cliente dono do token (cliente não apagado). Trocar de cliente exige adivinhar um UUID aleatório — impraticável. Token inválido → erro, sem dados.
- **Revogação:** não existe botão para revogar/regenerar o link. Um token só deixa de funcionar se o cliente for apagado ou o token mudado na base.
- **Mobile já existente:** o projeto já tem Capacitor instalado (Android/iOS), mas configurado para a app interna das oficinas ("GarageFlow", aponta para o preview de desenvolvimento). Não serve para clientes tal como está.

## Solução recomendada
Uma app Capacitor separada, **GarageFlow Clientes**, que mostra o portal existente (`garageflow.pt/portal/...`) — sem novo portal, sem nova base de dados, sem login novo.
- **1.ª utilização:** ecrã simples "Cole ou abra o seu link do portal" (+ abrir automaticamente quando o cliente toca no link recebido, via deep link).
- **App valida** chamando a mesma função `get_client_portal_data`; só associa se o servidor devolver dados.
- **Guarda o token no armazenamento seguro do telemóvel** (Keychain iOS / Keystore Android), nunca em logs.
- **Utilizações seguintes:** abre direto no portal. Se o servidor deixar de aceitar o token → mensagem "Acesso já não é válido, peça novo link à oficina" e apaga a associação. Botão "Desassociar este telemóvel".

## Alterações (mínimas e isoladas)
- Nova página `/app-clientes` (ecrã de associação) — só usada pela app; nada muda no portal web nem nos links.
- Nova config Capacitor dedicada (`capacitor.clientes.config.ts`, appId próprio, nome "GarageFlow Clientes") — a config atual das oficinas fica intacta.
- 1 dependência gratuita de armazenamento seguro.
- Testes automáticos da validação/associação.
- **Sem** migrações, RLS, alterações ao portal, Clients, Stripe ou faturação.

## Riscos
- Sem revogação de link hoje: se um link for partilhado indevidamente, continua válido (já é assim na web). Proposta opcional, **só com autorização**: botão "Regenerar link" para a oficina (invalida o antigo, também na app).
- Pagamentos Stripe dentro da app: o regresso do checkout poderá abrir no browser; validar em dispositivo.

## Testes (Fase 4)
Portal web pelo link original; link válido associa; reabrir mantém o portal certo; link inválido/inexistente recusado; dados reais; ecrãs 360/390/430 px; oficina continua a copiar links. Compilação nativa e testes em dispositivo ficam do teu lado (eu não tenho Xcode/Android Studio).

## Publicação e custos
- Android: conta Google Play 25 USD (pagamento único) + Android Studio (grátis).
- iPhone: Apple Developer 99 USD/ano + Mac com Xcode.
- Atualizações do portal chegam à app sem nova versão (carrega o site); só mudanças na casca nativa exigem nova submissão às lojas.
- Nada será publicado nem comprado sem autorização.
