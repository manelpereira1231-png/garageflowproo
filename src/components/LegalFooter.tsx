import { Link } from "react-router-dom";

export default function LegalFooter() {
  return (
    <footer className="border-t bg-card/50 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>© {new Date().getFullYear()} GarageFlow Lda. · NIF 518000000 · Todos os direitos reservados.</div>
          <nav className="flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/legal/privacy" className="hover:text-foreground">Privacidade</Link>
            <Link to="/legal/terms" className="hover:text-foreground">Termos</Link>
            <Link to="/legal/market-terms" className="hover:text-foreground">Termos Market</Link>
            <Link to="/legal/cookies" className="hover:text-foreground">Cookies</Link>
            <Link to="/legal/dpa" className="hover:text-foreground">DPA</Link>
            <Link to="/legal/my-data" className="hover:text-foreground">Os Meus Dados</Link>
            <Link to="/support" className="hover:text-foreground font-medium text-primary">Suporte</Link>
          </nav>
        </div>
        <div className="text-[11px] opacity-80">
          Sede: Rua da Inovação 123, 4400-000 Vila Nova de Gaia, Portugal · <a href="mailto:suporte@garageflow.pt" className="underline hover:text-foreground">suporte@garageflow.pt</a>
        </div>
      </div>
    </footer>
  );
}
