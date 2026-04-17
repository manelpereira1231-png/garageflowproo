import { Link } from "react-router-dom";
import { ShieldCheck, ArrowLeft } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <Link to="/" className="flex items-center gap-2 font-bold">
            <ShieldCheck className="h-5 w-5 text-primary" /> GarageFlow
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 prose prose-slate dark:prose-invert">
        <h1>Termos de Utilização</h1>
        <p className="text-sm text-muted-foreground">Última atualização: 16 de abril de 2026</p>

        <h2>1. Aceitação</h2>
        <p>
          Ao criar uma conta ou utilizar a plataforma <strong>GarageFlow</strong> aceita
          integralmente os presentes Termos. Se não concordar, não utilize o serviço.
        </p>

        <h2>2. Descrição do serviço</h2>
        <p>O GarageFlow disponibiliza dois produtos distintos:</p>
        <ul>
          <li><strong>GarageFlow ERP</strong> — software SaaS de gestão para oficinas automóvel (orçamentos, ordens de serviço, faturação, clientes, stock).</li>
          <li><strong>GarageFlow Market</strong> — marketplace de veículos usados com inspeção física obrigatória e pagamento protegido (escrow).</li>
        </ul>

        <h2>3. Conta e responsabilidade</h2>
        <ul>
          <li>O utilizador é responsável pela confidencialidade da sua password.</li>
          <li>É proibido partilhar credenciais com terceiros.</li>
          <li>Toda a atividade realizada com a conta é da responsabilidade do titular.</li>
        </ul>

        <h2>4. Planos, preços e teste gratuito</h2>
        <p>
          Os planos do ERP (Free, Pro 49€/mês, Garage 99€/mês) incluem teste gratuito de 30 dias.
          Cada utilizador / NIF tem direito a apenas um período experimental. Tentativas de
          contornar este limite (múltiplas contas) podem levar à suspensão.
        </p>
        <p>
          Os pagamentos recorrentes são processados pelo Stripe. Pode cancelar a qualquer momento
          através do portal de faturação. O cancelamento entra em vigor no fim do ciclo pago.
        </p>

        <h2>5. Regras específicas do Market</h2>
        <ul>
          <li>Apenas anúncios com inspeção física certificada por oficina parceira são publicados.</li>
          <li>É <strong>proibido partilhar contactos pessoais</strong> (telefone, e-mail, redes sociais) no chat. Tentativas reincidentes resultam em suspensão automática.</li>
          <li>O pagamento ocorre exclusivamente em escrow Stripe. Comissão da plataforma: 2% sobre o valor da venda.</li>
          <li>Inspeção: valor variável por país (p. ex. 29,90€ em Portugal) pago pelo vendedor, com reembolso integral se o vendedor recusar a venda após relatório positivo. Distribuição transparente em <Link to="/market/payout-info" className="underline">Como recebo</Link>.</li>
          <li>Janela de satisfação de 48h após confirmação de entrega antes da libertação automática dos fundos ao vendedor.</li>
          <li>É proibido publicar anúncios fraudulentos, com VIN duplicado ou dados falsos. A plataforma reserva-se o direito de remover anúncios e suspender contas.</li>
        </ul>

        <h2>6. Propriedade intelectual</h2>
        <p>
          O software, marca, logótipo e conteúdos da plataforma são propriedade do GarageFlow.
          Os dados introduzidos pelo utilizador (clientes, veículos, anúncios) permanecem propriedade
          do utilizador, sendo concedida ao GarageFlow uma licença limitada para os processar com o
          fim de prestar o serviço.
        </p>

        <h2>7. Limitação de responsabilidade</h2>
        <p>
          Na máxima extensão permitida por lei, o GarageFlow não responde por:
        </p>
        <ul>
          <li>Lucros cessantes, perda de dados ou danos indiretos;</li>
          <li>Disputas entre comprador e vendedor no Market — atuamos apenas como intermediários do escrow;</li>
          <li>Conteúdo introduzido pelos utilizadores;</li>
          <li>Indisponibilidades pontuais do serviço (SLA 99,5% / mês).</li>
        </ul>
        <p>
          A responsabilidade total agregada do GarageFlow está limitada ao valor pago pelo utilizador
          nos últimos 12 meses.
        </p>

        <h2>8. Conformidade fiscal (importante)</h2>
        <p>
          O GarageFlow ERP <strong>não está certificado pela Autoridade Tributária portuguesa</strong>.
          Os documentos financeiros gerados (faturas, recibos) incluem aviso legal e devem ser
          validados/substituídos por software certificado caso o utilizador esteja sujeito a essa
          obrigação. A exportação SAF-T PT é fornecida como auxiliar de gestão.
        </p>

        <h2>9. Suspensão e eliminação</h2>
        <p>
          Podemos suspender ou eliminar contas que violem estes Termos, com ou sem aviso prévio,
          designadamente em caso de fraude, evasão de chat, anúncios falsos ou abuso do serviço.
        </p>

        <h2>10. Direitos do consumidor (PT e ES)</h2>
        <p>
          Quando o utilizador atua na qualidade de <strong>consumidor</strong>:
        </p>
        <ul>
          <li><strong>Portugal:</strong> aplica-se o Decreto-Lei n.º 24/2014 (contratos à distância) e a Lei n.º 24/96 (Lei de Defesa do Consumidor). Tem direito a 14 dias de livre resolução para serviços digitais não totalmente executados.</li>
          <li><strong>Espanha:</strong> aplica-se o Real Decreto Legislativo 1/2007 (Texto Refundido de la Ley General para la Defensa de Consumidores y Usuarios). Igualmente reconhecido o direito de desistência de 14 dias naturais.</li>
          <li>O utilizador consumidor renuncia expressamente ao direito de livre resolução ao iniciar o uso efetivo do software durante o período de teste, nos termos legais aplicáveis.</li>
        </ul>

        <h2>11. Lei aplicável e foro</h2>
        <p>
          Estes Termos regem-se pela <strong>lei portuguesa</strong>. Para litígios profissionais é
          competente o foro da comarca de Lisboa.
        </p>
        <p>
          Para utilizadores consumidores residentes em <strong>Espanha</strong>, mantêm-se aplicáveis
          as normas imperativas de proteção do consumidor do seu país de residência, sendo competente
          o foro do seu domicílio quando exigido por lei.
        </p>
        <p>
          Pode recorrer a meios alternativos de resolução de litígios:
        </p>
        <ul>
          <li>Plataforma europeia ODR: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noreferrer">ec.europa.eu/consumers/odr</a></li>
          <li><strong>Portugal:</strong> CNIACC — Centro Nacional de Informação e Arbitragem de Conflitos de Consumo (<a href="https://www.cniacc.pt" target="_blank" rel="noreferrer">cniacc.pt</a>).</li>
          <li><strong>Espanha:</strong> Sistema Arbitral de Consumo — <a href="https://www.consumo.gob.es" target="_blank" rel="noreferrer">consumo.gob.es</a>.</li>
        </ul>

        <hr />
        <p className="text-sm">
          Ver também: <Link to="/legal/privacy">Política de Privacidade</Link> ·{" "}
          <Link to="/legal/cookies">Cookies</Link> ·{" "}
          <Link to="/legal/market-terms">Termos do Market</Link>
        </p>
      </main>
    </div>
  );
}
