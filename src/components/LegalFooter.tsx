/**
 * LegalFooter — renders company legal info from the admin-managed
 * `legal_settings` singleton. NEVER hardcodes NIF, address, capital,
 * or AT certification. When not configured, shows only:
 *   GarageFlow · <contact_email> · dev-mode disclaimer.
 */
import { Link } from "react-router-dom";
import { useLegalSettings } from "@/hooks/useLegalSettings";

const MINIMAL_FALLBACK =
  "GarageFlow — Software de gestão de oficinas.";

export default function LegalFooter() {
  const { settings, isConfigured, contactEmail, showInFooter } = useLegalSettings();

  if (!showInFooter) return null;

  return (
    <footer className="border-t bg-card/50 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {isConfigured ? (
            <div>
              © {new Date().getFullYear()} {settings?.company_name}
              {settings?.tax_id ? ` · NIF ${settings.tax_id}` : ""}
              {settings?.copyright_text ? ` · ${settings.copyright_text}` : " · Todos os direitos reservados."}
            </div>
          ) : (
            <div>GarageFlow · <a href={`mailto:${contactEmail}`} className="underline hover:text-foreground">{contactEmail}</a></div>
          )}
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
        {isConfigured && settings?.social_links && Object.values(settings.social_links).some(Boolean) ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            {settings.social_links.facebook && <a href={settings.social_links.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Facebook</a>}
            {settings.social_links.instagram && <a href={settings.social_links.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Instagram</a>}
            {settings.social_links.linkedin && <a href={settings.social_links.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">LinkedIn</a>}
            {settings.social_links.other && <a href={settings.social_links.other} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Website</a>}
          </div>
        ) : null}
        {isConfigured ? (
          <div className="text-[11px] opacity-80">
            {[settings?.address, settings?.postal_code, settings?.city, settings?.country].filter(Boolean).join(", ")}
            {settings?.contact_phone ? ` · Tel ${settings.contact_phone}` : ""}
            {" · "}
            <a href={`mailto:${contactEmail}`} className="underline hover:text-foreground">{contactEmail}</a>
            {settings?.at_certified && settings?.at_certificate_number ? (
              <> · Sistema certificado pela AT n.º {settings.at_certificate_number}</>
            ) : (
              <> · Sistema não certificado pela AT — documentos apenas para uso interno da oficina.</>
            )}
            {settings?.footer_text ? <> · {settings.footer_text}</> : null}
          </div>
        ) : (
          <div className="text-[11px] opacity-80">{DEV_DISCLAIMER}</div>
        )}
      </div>
    </footer>
  );
}
