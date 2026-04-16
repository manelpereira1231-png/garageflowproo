import { Link } from "react-router-dom";
import { ShieldCheck, ArrowLeft } from "lucide-react";

export default function DPA() {
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
        <h1>Acordo de Subcontratação de Dados (DPA)</h1>
        <p className="text-sm text-muted-foreground">Versão 1.0 — 16 de abril de 2026</p>

        <p>
          Este DPA aplica-se a todos os clientes do <strong>GarageFlow ERP</strong> que, no âmbito
          da utilização do serviço, tratam dados pessoais de terceiros (clientes finais da oficina,
          colaboradores, etc.). Constitui parte integrante dos Termos de Utilização e cumpre o
          art.º 28.º do RGPD.
        </p>

        <h2>1. Partes</h2>
        <ul>
          <li><strong>Responsável pelo tratamento:</strong> a oficina cliente do GarageFlow ERP.</li>
          <li><strong>Subcontratante:</strong> GarageFlow.</li>
        </ul>

        <h2>2. Objeto e duração</h2>
        <p>
          O subcontratante trata dados pessoais por conta do responsável durante toda a vigência
          da subscrição, incluindo após cancelamento pelo período de 30 dias para permitir
          exportação dos dados.
        </p>

        <h2>3. Natureza e finalidade do tratamento</h2>
        <p>
          Alojamento, processamento, backup e disponibilização dos dados introduzidos pelo
          responsável no contexto da gestão da oficina (clientes, veículos, orçamentos, faturas,
          mensagens).
        </p>

        <h2>4. Tipos de dados e categorias de titulares</h2>
        <ul>
          <li>Clientes finais da oficina: nome, contactos, NIF, morada.</li>
          <li>Veículos: matrícula, VIN, dados técnicos.</li>
          <li>Histórico de serviços e faturação.</li>
          <li>Colaboradores da oficina: nome, e-mail, função.</li>
        </ul>

        <h2>5. Obrigações do subcontratante</h2>
        <p>O GarageFlow compromete-se a:</p>
        <ul>
          <li>Tratar os dados apenas em conformidade com instruções documentadas do responsável;</li>
          <li>Garantir confidencialidade do pessoal autorizado;</li>
          <li>Aplicar medidas técnicas e organizativas adequadas (art.º 32.º RGPD): cifra em trânsito (TLS) e em repouso, RLS, MFA disponível, logs imutáveis, backups diários, deteção de intrusão;</li>
          <li>Notificar o responsável <strong>sem demora injustificada</strong> e nunca após 48h em caso de violação de dados (art.º 33.º);</li>
          <li>Apoiar o responsável no cumprimento dos direitos dos titulares;</li>
          <li>Devolver ou eliminar os dados após cessação do contrato, salvo obrigações legais de conservação (faturas: 10 anos);</li>
          <li>Disponibilizar informação para auditorias razoavelmente solicitadas.</li>
        </ul>

        <h2>6. Subcontratantes ulteriores autorizados</h2>
        <p>O responsável autoriza o recurso aos seguintes subcontratantes:</p>
        <ul>
          <li>Supabase (hosting / base de dados) — UE.</li>
          <li>Stripe Payments Europe Ltd. (pagamentos) — Irlanda.</li>
          <li>Resend (e-mail transacional).</li>
          <li>Vercel (CDN estática).</li>
        </ul>
        <p>
          Qualquer alteração será notificada com 30 dias de antecedência. O responsável poderá
          opor-se com base em motivos relacionados com proteção de dados, podendo nesse caso
          rescindir o contrato.
        </p>

        <h2>7. Transferências internacionais</h2>
        <p>
          Sempre que possível, os dados são processados em data centers da UE. Quando ocorra
          transferência para país terceiro, será coberta pelas <em>Standard Contractual Clauses</em>
          da Comissão Europeia ou por decisão de adequação.
        </p>

        <h2>8. Auditoria</h2>
        <p>
          O responsável pode solicitar, com pré-aviso de 30 dias e não mais de uma vez por ano,
          informação atualizada sobre as medidas de segurança aplicadas, incluindo cópia de relatórios
          SOC 2 ou equivalentes dos subcontratantes.
        </p>

        <h2>9. Aceitação</h2>
        <p>
          Este DPA considera-se aceite com a aceitação dos Termos de Utilização. Para uma versão
          assinada solicite-a a{" "}
          <a href="mailto:dpo@garageflow.pt">dpo@garageflow.pt</a>.
        </p>

        <hr />
        <p className="text-sm">
          Ver também: <Link to="/legal/privacy">Privacidade</Link> ·{" "}
          <Link to="/legal/terms">Termos</Link>
        </p>
      </main>
    </div>
  );
}
