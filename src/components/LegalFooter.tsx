import { Link } from "react-router-dom";

export default function LegalFooter() {
  return (
    <footer className="border-t bg-card/50 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div>© {new Date().getFullYear()} GarageFlow. Todos os direitos reservados.</div>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          <Link to="/legal/privacy" className="hover:text-foreground">Privacidade</Link>
          <Link to="/legal/terms" className="hover:text-foreground">Termos</Link>
          <Link to="/legal/cookies" className="hover:text-foreground">Cookies</Link>
          <Link to="/legal/dpa" className="hover:text-foreground">DPA</Link>
          <Link to="/legal/my-data" className="hover:text-foreground">Os Meus Dados</Link>
        </nav>
      </div>
    </footer>
  );
}
