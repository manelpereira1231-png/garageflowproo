import { Link } from "react-router-dom";
import { ShieldCheck, ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
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
        <h1>Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground">Última atualização: 16 de abril de 2026</p>

        <p>
          A presente Política de Privacidade descreve como o <strong>GarageFlow</strong> ("nós",
          "plataforma") recolhe, utiliza, conserva e protege os dados pessoais dos utilizadores
          do software de gestão para oficinas (<em>GarageFlow ERP</em>) e do marketplace de
          veículos (<em>GarageFlow Market</em>), em conformidade com o Regulamento (UE) 2016/679
          (RGPD) e a Lei n.º 58/2019 de Portugal.
        </p>

        <h2>1. Responsável pelo tratamento</h2>
        <p>
          Responsável: <strong>GarageFlow</strong> — [Nome legal da entidade], NIF [—], com sede em
          [morada], Portugal. Contacto para questões de privacidade:{" "}
          <a href="mailto:privacidade@garageflow.pt">privacidade@garageflow.pt</a>.
        </p>

        <h2>2. Que dados recolhemos</h2>
        <ul>
          <li><strong>Identificação e conta:</strong> nome, e-mail, telefone, password (cifrada).</li>
          <li><strong>Dados profissionais (ERP):</strong> nome da oficina, NIF, morada, logótipo, equipa.</li>
          <li><strong>Dados de clientes finais (ERP):</strong> introduzidos pelas oficinas no âmbito da prestação de serviços (clientes, veículos, matrículas, VIN, histórico). A oficina é o <em>responsável pelo tratamento</em> destes dados; o GarageFlow atua como <em>subcontratante</em>.</li>
          <li><strong>Dados do Market:</strong> KYC do vendedor (documento de identificação, selfie, NIF), localização do veículo, comunicações via chat.</li>
          <li><strong>Dados de pagamento:</strong> processados exclusivamente pelo Stripe (PCI-DSS Nível 1). Nunca armazenamos números de cartão.</li>
          <li><strong>Dados técnicos:</strong> endereço IP, tipo de dispositivo, browser, idioma, páginas visitadas.</li>
        </ul>

        <h2>3. Finalidades e base legal</h2>
        <table>
          <thead><tr><th>Finalidade</th><th>Base legal (RGPD)</th></tr></thead>
          <tbody>
            <tr><td>Prestação do serviço (ERP/Market)</td><td>Execução do contrato (art.º 6.º, n.º 1, b))</td></tr>
            <tr><td>Faturação e cumprimento fiscal</td><td>Obrigação legal (art.º 6.º, n.º 1, c))</td></tr>
            <tr><td>Prevenção de fraude e segurança</td><td>Interesse legítimo (art.º 6.º, n.º 1, f))</td></tr>
            <tr><td>Comunicações de marketing</td><td>Consentimento (art.º 6.º, n.º 1, a))</td></tr>
            <tr><td>Cookies analíticos e publicitários</td><td>Consentimento (ePrivacy + art.º 6.º, n.º 1, a))</td></tr>
            <tr><td>KYC do vendedor (Market)</td><td>Obrigação legal anti-fraude / interesse legítimo</td></tr>
          </tbody>
        </table>

        <h2>4. Subcontratantes e transferências</h2>
        <p>Recorremos aos seguintes prestadores, todos com contratos RGPD em vigor:</p>
        <ul>
          <li><strong>Supabase</strong> (hosting, base de dados) — UE.</li>
          <li><strong>Stripe Payments Europe Ltd.</strong> — Irlanda (UE).</li>
          <li><strong>Resend</strong> — envio transacional de e-mail.</li>
          <li><strong>Google Ads / Analytics</strong> — apenas com consentimento. Pode envolver transferência para países terceiros (EUA), ao abrigo das <em>Standard Contractual Clauses</em> e do <em>EU-US Data Privacy Framework</em>.</li>
          <li><strong>Vercel</strong> — entrega de conteúdo estático (CDN).</li>
        </ul>

        <h2>5. Conservação</h2>
        <ul>
          <li>Conta de utilizador: enquanto a conta estiver ativa + 30 dias após eliminação.</li>
          <li>Documentos fiscais (faturas): <strong>10 anos</strong> (obrigação legal — Código do IVA).</li>
          <li>KYC do Market: 5 anos após a última transação (Lei n.º 83/2017 — branqueamento de capitais).</li>
          <li>Logs de segurança e auditoria: 12 meses.</li>
          <li>Cookies não essenciais: até 13 meses ou até retirada do consentimento.</li>
        </ul>

        <h2>6. Os seus direitos</h2>
        <p>Tem direito a, a qualquer momento e gratuitamente:</p>
        <ul>
          <li>Aceder e obter cópia dos seus dados (portabilidade);</li>
          <li>Retificar dados incorretos;</li>
          <li>Apagar a sua conta e dados associados (direito ao esquecimento), salvo obrigações legais de conservação;</li>
          <li>Limitar ou opor-se ao tratamento;</li>
          <li>Retirar o consentimento a qualquer momento;</li>
          <li>Apresentar reclamação à <strong>CNPD — Comissão Nacional de Proteção de Dados</strong> (<a href="https://www.cnpd.pt" target="_blank" rel="noreferrer">cnpd.pt</a>).</li>
        </ul>
        <p>
          Pode exercer estes direitos através da página{" "}
          <Link to="/legal/my-data">Os Meus Dados</Link> (após login) ou enviando e-mail para{" "}
          <a href="mailto:privacidade@garageflow.pt">privacidade@garageflow.pt</a>.
        </p>

        <h2>7. Segurança</h2>
        <p>
          Aplicamos medidas técnicas e organizativas: cifra TLS 1.2+ em trânsito, cifra em repouso,
          isolamento multi-tenant via <em>Row-Level Security</em>, autenticação com hashing bcrypt,
          rate-limiting, deteção de fraude automatizada, backups diários e logs de auditoria
          imutáveis. Em caso de violação de dados notificaremos a CNPD e os utilizadores afetados
          em conformidade com o art.º 33.º e 34.º do RGPD.
        </p>

        <h2>8. Menores</h2>
        <p>O serviço destina-se a maiores de 18 anos. Não recolhemos intencionalmente dados de menores.</p>

        <h2>9. Alterações</h2>
        <p>
          Atualizações a esta política são publicadas nesta página. Alterações materiais serão
          notificadas por e-mail com pelo menos 30 dias de antecedência.
        </p>

        <hr />
        <p className="text-sm">
          Ver também: <Link to="/legal/terms">Termos de Utilização</Link> ·{" "}
          <Link to="/legal/cookies">Política de Cookies</Link> ·{" "}
          <Link to="/legal/dpa">DPA (Subcontratação)</Link>
        </p>
      </main>
    </div>
  );
}
