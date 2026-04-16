import { Link } from "react-router-dom";
import { ShieldCheck, ArrowLeft } from "lucide-react";

export default function MarketTerms() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/market" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar ao Market
          </Link>
          <Link to="/" className="flex items-center gap-2 font-bold">
            <ShieldCheck className="h-5 w-5 text-primary" /> GarageFlow Market
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 prose prose-slate dark:prose-invert">
        <h1>Termos e Condições — GarageFlow Market</h1>
        <p className="text-sm text-muted-foreground">
          Última atualização: 16 de abril de 2026 · Versão aplicável a Portugal e Espanha
        </p>

        <p>
          Estes Termos regem a utilização do <strong>GarageFlow Market</strong>, marketplace de
          veículos usados com inspeção física obrigatória e pagamento protegido em escrow. Aplicam-se
          a compradores e vendedores residentes em <strong>Portugal</strong> e <strong>Espanha</strong>,
          em complemento aos <Link to="/legal/terms">Termos Gerais</Link> e à{" "}
          <Link to="/legal/privacy">Política de Privacidade</Link>.
        </p>

        <h2>1. Papel da plataforma</h2>
        <p>
          O GarageFlow Market é um <strong>intermediário tecnológico</strong> que liga vendedores
          particulares a compradores e fornece serviços auxiliares (publicação, inspeção certificada,
          escrow Stripe, contrato digital). <strong>O GarageFlow não é parte do contrato de compra
          e venda</strong> celebrado entre comprador e vendedor.
        </p>

        <h2>2. Identificação e KYC</h2>
        <ul>
          <li>Vendedores são obrigados a submeter KYC (documento de identificação válido + selfie + NIF/NIE) antes de publicar.</li>
          <li>Os documentos são conservados durante 5 anos após a última transação, ao abrigo da Lei n.º 83/2017 (PT) e da Ley 10/2010 (ES) sobre prevenção do branqueamento de capitais.</li>
          <li>O fornecimento de dados falsos constitui infração e pode ser comunicado às autoridades competentes.</li>
        </ul>

        <h2>3. Inspeção obrigatória e taxas</h2>
        <ul>
          <li>Todos os anúncios exigem inspeção física por uma oficina parceira certificada.</li>
          <li>Custo da inspeção: <strong>24,90 €</strong>, pago pelo comprador interessado.</li>
          <li>Distribuição: 65% para a oficina (16,18 €), 35% para a plataforma (8,72 €).</li>
          <li>O comprador é integralmente reembolsado se o vendedor recusar a venda após relatório positivo ou se o veículo for considerado <em>não recomendado</em>.</li>
        </ul>

        <h2>4. Pagamento em escrow (Stripe)</h2>
        <ul>
          <li>O pagamento é processado exclusivamente via <strong>Stripe Payments Europe Ltd.</strong>, certificado PCI-DSS Nível 1.</li>
          <li>Os fundos ficam retidos em escrow até confirmação de entrega pelo comprador.</li>
          <li>Comissão da plataforma: <strong>2 %</strong> sobre o valor da venda, deduzida no momento da libertação.</li>
          <li>Janela de satisfação: <strong>48 horas</strong> após confirmação de entrega antes da libertação automática ao vendedor.</li>
          <li>Disputas abertas dentro da janela suspendem a libertação até resolução pela equipa de mediação.</li>
        </ul>

        <h2>5. Direito de livre resolução (consumidores)</h2>
        <p>
          Atendendo à natureza do bem (veículo usado, identificado pelo VIN e personalizado para o
          comprador específico após inspeção e contrato assinado), aplicam-se as seguintes regras:
        </p>
        <ul>
          <li>
            <strong>Portugal — Decreto-Lei n.º 24/2014, art.º 17.º, n.º 1, c) e d):</strong> o direito
            de livre resolução de 14 dias <em>não se aplica</em> a bens confecionados de acordo com
            especificações do consumidor ou claramente personalizados, nem a bens cujo preço dependa
            de flutuações dos mercados não controláveis.
          </li>
          <li>
            <strong>Espanha — RDLeg 1/2007, art.º 103, c) e d):</strong> idêntica exclusão para bens
            confecionados conforme especificações do consumidor ou claramente personalizados.
          </li>
          <li>
            Os <strong>serviços auxiliares</strong> da plataforma (taxa de inspeção, comissão de
            intermediação) <em>são reembolsáveis</em> nas condições previstas na cláusula 3 e nas
            políticas internas da plataforma.
          </li>
        </ul>

        <h2>6. Garantias do veículo</h2>
        <p>
          Tratando-se de venda entre particulares:
        </p>
        <ul>
          <li>
            <strong>Portugal:</strong> a garantia legal de conformidade prevista no Decreto-Lei
            n.º 84/2021 aplica-se apenas a vendas por profissionais, pelo que <em>não é exigível</em>
            ao vendedor particular. Subsiste, contudo, o regime civil da venda de coisas defeituosas
            (art.º 913.º e ss. do Código Civil) em caso de defeitos ocultos.
          </li>
          <li>
            <strong>Espanha:</strong> idêntica regra — a garantia do RDLeg 1/2007 não se aplica a
            vendas entre particulares; subsiste o regime do <em>saneamiento por vicios ocultos</em>
            (art.º 1484 e ss. do Código Civil espanhol).
          </li>
          <li>
            O relatório de inspeção da oficina parceira tem valor probatório do estado do veículo à
            data da inspeção, mas não constitui garantia futura.
          </li>
        </ul>

        <h2>7. Comunicação no chat — proteção anti-fraude</h2>
        <ul>
          <li>É <strong>proibido</strong> partilhar telefone, e-mail, redes sociais ou IBAN diretamente no chat.</li>
          <li>O sistema deteta automaticamente tentativas de fuga e regista-as para auditoria.</li>
          <li>3 ou mais infrações resultam em <strong>suspensão automática</strong> da conta.</li>
          <li>Esta restrição protege ambas as partes contra burlas e garante que a transação ocorra dentro do escrow.</li>
        </ul>

        <h2>8. Disputas e mediação</h2>
        <ul>
          <li>Compradores podem abrir disputa durante a janela de satisfação (48 h pós-entrega).</li>
          <li>A equipa de mediação analisa o relatório de inspeção, o contrato e provas submetidas (fotos, vídeos, comunicações).</li>
          <li>Resolução típica: 5 a 10 dias úteis.</li>
          <li>Recurso adicional: ODR europeu (<a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noreferrer">ec.europa.eu/consumers/odr</a>).</li>
        </ul>

        <h2>9. Suspensão e remoção</h2>
        <p>
          A plataforma reserva-se o direito de suspender contas e remover anúncios em caso de:
          dados falsos, VIN duplicado, fuga reincidente do chat, disputas múltiplas confirmadas ou
          violação destes Termos.
        </p>

        <h2>10. Lei aplicável e foro</h2>
        <p>
          Estes Termos do Market regem-se pela <strong>lei portuguesa</strong>. Para utilizadores
          consumidores residentes em Espanha mantêm-se aplicáveis as normas imperativas de proteção
          do consumidor espanholas e a competência dos tribunais do seu domicílio quando exigido
          por lei imperativa.
        </p>

        <hr />
        <p className="text-sm">
          Ver também: <Link to="/legal/terms">Termos Gerais</Link> ·{" "}
          <Link to="/legal/privacy">Privacidade</Link> ·{" "}
          <Link to="/legal/cookies">Cookies</Link> ·{" "}
          <Link to="/legal/my-data">Os Meus Dados</Link>
        </p>
      </main>
    </div>
  );
}
