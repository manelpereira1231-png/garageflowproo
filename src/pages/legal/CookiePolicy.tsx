import { Link } from "react-router-dom";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CookiePolicy() {
  const reopenBanner = () => {
    localStorage.removeItem("gf_cookie_consent");
    window.location.reload();
  };

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
        <h1>Política de Cookies</h1>
        <p className="text-sm text-muted-foreground">Última atualização: 16 de abril de 2026</p>

        <p>
          Esta página explica que cookies o <strong>GarageFlow</strong> utiliza, para que servem e
          como pode geri-los, em conformidade com o RGPD e a Diretiva ePrivacy.
        </p>

        <h2>O que são cookies</h2>
        <p>
          Cookies são pequenos ficheiros de texto guardados no seu dispositivo pelo browser quando
          visita um site. Permitem reconhecer o utilizador, lembrar preferências e medir audiência.
        </p>

        <h2>Categorias de cookies que utilizamos</h2>

        <h3>1. Estritamente necessários (sempre ativos)</h3>
        <p>Indispensáveis ao funcionamento da plataforma. Não requerem consentimento.</p>
        <ul>
          <li><code>sb-*</code> — sessão de autenticação Supabase.</li>
          <li><code>gf_active_shop</code> — oficina ativa do utilizador.</li>
          <li><code>garageflow_language</code> — idioma escolhido.</li>
          <li><code>sidebar:state</code> — estado da barra lateral.</li>
          <li><code>gf_cookie_consent</code> — registo do seu consentimento.</li>
        </ul>

        <h3>2. Analíticos (opcionais)</h3>
        <p>Permitem medir uso e melhorar a plataforma. Só são ativados após consentimento.</p>
        <ul>
          <li><code>_ga, _ga_*</code> — Google Analytics (audiência agregada).</li>
        </ul>

        <h3>3. Marketing e publicidade (opcionais)</h3>
        <p>Permitem medir conversões e otimizar campanhas. Só são ativados após consentimento.</p>
        <ul>
          <li><code>_gcl_au, _gcl_aw</code> — Google Ads (atribuição de conversões).</li>
        </ul>

        <h2>Como gerir o seu consentimento</h2>
        <p>
          Pode reabrir o banner e alterar as suas escolhas a qualquer momento clicando no botão
          abaixo. Pode ainda gerir cookies diretamente nas definições do seu browser.
        </p>
        <Button onClick={reopenBanner} variant="outline" className="not-prose">
          Gerir as minhas preferências de cookies
        </Button>

        <h2>Conservação</h2>
        <p>
          Cookies de sessão expiram quando fecha o browser. Cookies persistentes (analíticos /
          marketing) expiram em até 13 meses, salvo se os apagar antes.
        </p>

        <hr />
        <p className="text-sm">
          Ver também: <Link to="/legal/privacy">Política de Privacidade</Link> ·{" "}
          <Link to="/legal/terms">Termos</Link>
        </p>
      </main>
    </div>
  );
}
