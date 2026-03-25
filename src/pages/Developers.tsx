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
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

const API_DOC_KEYS = [
  { method: "GET", path: "/clients", key: "developers.api.listClients" },
  { method: "GET", path: "/clients/:id", key: "developers.api.getClient" },
  { method: "POST", path: "/clients", key: "developers.api.createClient" },
  { method: "PUT", path: "/clients/:id", key: "developers.api.updateClient" },
  { method: "DELETE", path: "/clients/:id", key: "developers.api.deleteClient" },
  { method: "GET", path: "/vehicles", key: "developers.api.listVehicles" },
  { method: "GET", path: "/vehicles/:id", key: "developers.api.getVehicle" },
  { method: "POST", path: "/vehicles", key: "developers.api.createVehicle" },
  { method: "PUT", path: "/vehicles/:id", key: "developers.api.updateVehicle" },
  { method: "GET", path: "/quotes", key: "developers.api.listQuotes" },
  { method: "GET", path: "/services", key: "developers.api.listCatalog" },
  { method: "POST", path: "/services", key: "developers.api.createCatalog" },
  { method: "GET", path: "/work-orders", key: "developers.api.listWorkOrders" },
  { method: "GET", path: "/invoices", key: "developers.api.listInvoices" },
  { method: "GET", path: "/appointments", key: "developers.api.listAppointments" },
  { method: "POST", path: "/appointments", key: "developers.api.createAppointment" },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
  POST: "bg-blue-500/10 text-blue-700 border-blue-300",
  PUT: "bg-amber-500/10 text-amber-700 border-amber-300",
  DELETE: "bg-red-500/10 text-red-700 border-red-300",
};

export default function Developers() {
  const { activeShopId } = useShopContext();
  const { t } = useLanguage();
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
    toast.success(t('developers.keyCreated'));
    load();
  };

  const deleteKey = async (id: string) => {
    await supabase.from("api_keys").delete().eq("id", id);
    toast.success(t('developers.keyDeleted'));
    load();
  };

  const copyKey = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t('common.copied'));
  };

  const baseUrl = `${window.location.origin}/functions/v1/garageflow-api`;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Code className="w-6 h-6 text-primary" /> {t('developers.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('developers.subtitle')}</p>
        </div>
        <Button onClick={() => { setCreateDialog(true); setNewKeyName("Default API Key"); setGeneratedKey(""); }}>
          <Plus className="w-4 h-4 mr-2" /> {t('developers.newKey')}
        </Button>
      </div>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Key className="w-4 h-4" /> API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t('developers.noKeys')}</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t('common.name')}</TableHead>
                <TableHead>{t('common.prefix') || 'Prefixo'}</TableHead>
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
          <CardTitle className="flex items-center gap-2 text-base"><Zap className="w-4 h-4" /> {t('developers.quickStart')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-sidebar rounded-lg p-4 text-sm font-mono text-sidebar-foreground overflow-x-auto">
            <p className="text-muted-foreground">// {t('developers.quickStartComment')}</p>
            <p className="mt-1">curl -X GET \</p>
            <p className="ml-4 text-primary">"{baseUrl}/clients" \</p>
            <p className="ml-4">-H "Authorization: Bearer YOUR_API_KEY"</p>
          </div>
        </CardContent>
      </Card>

      {/* Endpoints Documentation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ExternalLink className="w-4 h-4" /> {t('developers.endpoints')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-20">{t('developers.method')}</TableHead>
              <TableHead>{t('developers.endpoint')}</TableHead>
              <TableHead>{t('developers.description')}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {API_DOC_KEYS.map((ep, i) => (
                <TableRow key={i}>
                  <TableCell><Badge variant="outline" className={METHOD_COLORS[ep.method]}>{ep.method}</Badge></TableCell>
                  <TableCell><code className="text-xs">{ep.path}</code></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t(ep.key)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Rate Limiting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Shield className="w-4 h-4" /> {t('developers.limits')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="bg-muted rounded-lg p-3">
              <p className="font-medium">{t('developers.rateLimit')}</p>
              <p className="text-muted-foreground">{t('developers.rateLimitDesc')}</p>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <p className="font-medium">{t('developers.auth')}</p>
              <p className="text-muted-foreground">{t('developers.authDesc')}</p>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <p className="font-medium">{t('developers.format')}</p>
              <p className="text-muted-foreground">{t('developers.formatDesc')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create API Key Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('developers.newKey')}</DialogTitle></DialogHeader>
          {generatedKey ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t('developers.copyWarning')}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded text-xs break-all">{generatedKey}</code>
                <Button variant="outline" size="sm" onClick={() => copyKey(generatedKey)}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
              <DialogFooter><Button onClick={() => { setCreateDialog(false); setGeneratedKey(""); }}>{t('common.close')}</Button></DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div><Label>{t('developers.keyName')}</Label><Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} /></div>
              <DialogFooter><Button onClick={createApiKey}>{t('developers.generateKey')}</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}