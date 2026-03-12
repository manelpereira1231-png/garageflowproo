import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Code, Key, Plus, Copy, Trash2, Shield, Zap, ExternalLink } from "lucide-react";
import { useShopContext } from "@/hooks/useShopContext";
import { toast } from "sonner";

const API_DOCS = [
  { method: "GET", path: "/clients", desc: "Listar todos os clientes" },
  { method: "GET", path: "/clients/:id", desc: "Obter cliente por ID" },
  { method: "POST", path: "/clients", desc: "Criar novo cliente" },
  { method: "PUT", path: "/clients/:id", desc: "Atualizar cliente" },
  { method: "DELETE", path: "/clients/:id", desc: "Eliminar cliente (soft delete)" },
  { method: "GET", path: "/vehicles", desc: "Listar veículos" },
  { method: "GET", path: "/vehicles/:id", desc: "Obter veículo por ID" },
  { method: "POST", path: "/vehicles", desc: "Criar veículo" },
  { method: "PUT", path: "/vehicles/:id", desc: "Atualizar veículo" },
  { method: "GET", path: "/quotes", desc: "Listar orçamentos" },
  { method: "GET", path: "/services", desc: "Listar catálogo de serviços" },
  { method: "POST", path: "/services", desc: "Criar serviço no catálogo" },
  { method: "GET", path: "/work-orders", desc: "Listar ordens de serviço" },
  { method: "GET", path: "/invoices", desc: "Listar faturas" },
  { method: "GET", path: "/appointments", desc: "Listar agendamentos" },
  { method: "POST", path: "/appointments", desc: "Criar agendamento" },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
  POST: "bg-blue-500/10 text-blue-700 border-blue-300",
  PUT: "bg-amber-500/10 text-amber-700 border-amber-300",
  DELETE: "bg-red-500/10 text-red-700 border-red-300",
};

export default function Developers() {
  const { activeShopId } = useShopContext();
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [createDialog, setCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("Default API Key");
  const [generatedKey, setGeneratedKey] = useState("");

  const load = async () => {
    if (!activeShopId) return;
    const { data } = await supabase.from("api_keys").select("*").eq("shop_id", activeShopId).order("created_at", { ascending: false });
    if (data) setApiKeys(data);
  };

  useEffect(() => { load(); }, [activeShopId]);

  const generateKey = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let key = "gf_";
    for (let i = 0; i < 40; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
    return key;
  };

  const createApiKey = async () => {
    if (!activeShopId) return;
    const key = generateKey();
    const prefix = key.substring(0, 7);
    // Simple hash for storage (in production use proper hashing)
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    const { error } = await supabase.from("api_keys").insert({
      shop_id: activeShopId,
      name: newKeyName,
      key_hash: hash,
      key_prefix: prefix,
      scopes: ["read", "write"],
    });

    if (error) { toast.error(error.message); return; }
    setGeneratedKey(key);
    toast.success("API Key criada com sucesso!");
    load();
  };

  const deleteKey = async (id: string) => {
    await supabase.from("api_keys").delete().eq("id", id);
    toast.success("API Key removida.");
    load();
  };

  const copyKey = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const baseUrl = `${window.location.origin}/functions/v1/garageflow-api`;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Code className="w-6 h-6 text-primary" /> API & Developers</h1>
          <p className="text-muted-foreground text-sm">Integre o GarageFlow com os seus sistemas através da API REST.</p>
        </div>
        <Button onClick={() => { setCreateDialog(true); setNewKeyName("Default API Key"); setGeneratedKey(""); }}>
          <Plus className="w-4 h-4 mr-2" /> Nova API Key
        </Button>
      </div>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Key className="w-4 h-4" /> API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma API key criada. Crie uma para começar a integrar.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Prefixo</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead className="text-center">Requests</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {apiKeys.map(k => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell><code className="text-xs bg-muted px-2 py-0.5 rounded">{k.key_prefix}...</code></TableCell>
                    <TableCell>{(k.scopes || []).map((s: string) => <Badge key={s} variant="outline" className="mr-1 text-xs">{s}</Badge>)}</TableCell>
                    <TableCell className="text-center">{k.request_count}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => deleteKey(k.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Quick Start */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Zap className="w-4 h-4" /> Quick Start</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-sidebar rounded-lg p-4 text-sm font-mono text-sidebar-foreground overflow-x-auto">
            <p className="text-muted-foreground">// Exemplo: Listar clientes</p>
            <p className="mt-1">curl -X GET \</p>
            <p className="ml-4 text-primary">"{baseUrl}/clients" \</p>
            <p className="ml-4">-H "Authorization: Bearer YOUR_API_KEY"</p>
          </div>
        </CardContent>
      </Card>

      {/* Endpoints Documentation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ExternalLink className="w-4 h-4" /> Endpoints Disponíveis</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-20">Método</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead>Descrição</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {API_DOCS.map((ep, i) => (
                <TableRow key={i}>
                  <TableCell><Badge variant="outline" className={METHOD_COLORS[ep.method]}>{ep.method}</Badge></TableCell>
                  <TableCell><code className="text-xs">{ep.path}</code></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{ep.desc}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Rate Limiting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Shield className="w-4 h-4" /> Limites & Segurança</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="bg-muted rounded-lg p-3">
              <p className="font-medium">Rate Limit</p>
              <p className="text-muted-foreground">60 requests/min por key</p>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <p className="font-medium">Autenticação</p>
              <p className="text-muted-foreground">Bearer token via header</p>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <p className="font-medium">Formato</p>
              <p className="text-muted-foreground">JSON (application/json)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create API Key Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova API Key</DialogTitle></DialogHeader>
          {generatedKey ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Copie a sua API key agora. Ela não será mostrada novamente.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded text-xs break-all">{generatedKey}</code>
                <Button variant="outline" size="sm" onClick={() => copyKey(generatedKey)}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
              <DialogFooter><Button onClick={() => { setCreateDialog(false); setGeneratedKey(""); }}>Fechar</Button></DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div><Label>Nome da Key</Label><Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} /></div>
              <DialogFooter><Button onClick={createApiKey}>Gerar API Key</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
