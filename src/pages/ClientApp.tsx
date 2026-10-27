import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Link2, Unlink } from "lucide-react";
import { clearToken, extractPortalToken, loadStoredToken, saveToken } from "@/lib/clientAppLink";

const OPENED_FLAG = "garageflow_clientes_opened";

async function isValid(token: string): Promise<boolean | null> {
  const { data, error } = await supabase.rpc("get_client_portal_data", { _token: token });
  if (error) return /invalid|not found|token/i.test(error.message) ? false : null;
  return !!data && !(data as any)?.error;
}

export default function ClientApp() {
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "form" | "linked">("loading");
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await loadStoredToken();
      if (!stored) return setState("form");
      const ok = await isValid(stored);
      if (ok === false) {
        await clearToken();
        setMsg("O acesso guardado já não é válido. Peça um novo link à sua oficina.");
        return setState("form");
      }
      setToken(stored);
      setState("linked");
      if (ok && !sessionStorage.getItem(OPENED_FLAG)) {
        sessionStorage.setItem(OPENED_FLAG, "1");
        navigate(`/portal/${stored}`);
      }
    })();
  }, [navigate]);

  const associate = async () => {
    setMsg(null);
    const t = extractPortalToken(input);
    if (!t) return setMsg("Este link não parece ser um link do portal do cliente.");
    setBusy(true);
    const ok = await isValid(t);
    setBusy(false);
    if (ok === null) return setMsg("Sem ligação ao servidor. Tente novamente.");
    if (!ok) return setMsg("Link inválido ou sem acesso. Confirme com a sua oficina.");
    await saveToken(t);
    sessionStorage.setItem(OPENED_FLAG, "1");
    navigate(`/portal/${t}`);
  };

  const unlink = async () => {
    await clearToken();
    setToken(null);
    setInput("");
    setState("form");
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-5">
      <Helmet>
        <title>GarageFlow Clientes</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Helmet>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">GarageFlow Clientes</h1>
          <p className="text-sm text-muted-foreground">O portal da sua oficina, sempre à mão.</p>
        </div>

        {state === "loading" && <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />}

        {state === "form" && (
          <div className="space-y-3">
            <label htmlFor="portal-link" className="text-sm font-medium">Cole o link do portal enviado pela oficina</label>
            <Input id="portal-link" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="https://garageflow.pt/portal/…" className="h-12" autoComplete="off" />
            <Button className="w-full h-12" onClick={associate} disabled={busy || !input.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Associar portal
            </Button>
          </div>
        )}

        {state === "linked" && token && (
          <div className="space-y-3">
            <Button className="w-full h-12" onClick={() => navigate(`/portal/${token}`)}>Abrir o meu portal</Button>
            <Button variant="ghost" className="w-full h-11" onClick={unlink}>
              <Unlink className="h-4 w-4" /> Desassociar este telemóvel
            </Button>
          </div>
        )}

        {msg && <p role="alert" className="text-sm text-destructive text-center">{msg}</p>}
      </div>
    </main>
  );
}
