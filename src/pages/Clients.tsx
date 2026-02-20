import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Phone, Mail, Building2 } from "lucide-react";
import { toast } from "sonner";

interface ClientRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  company: string | null;
  nif: string | null;
  notes: string | null;
  created_at: string;
}

export default function Clients() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", company: "", nif: "", notes: "" });

  const fetchClients = async () => {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setClients(data);
  };

  useEffect(() => { fetchClients(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Sessão expirada"); setLoading(false); return; }

    const { data: shop } = await supabase.from("shops").select("id").eq("user_id", user.id).single();
    if (!shop) { toast.error("Configure a oficina primeiro"); setLoading(false); return; }

    const { error } = await supabase.from("clients").insert({
      shop_id: shop.id,
      name: form.name,
      phone: form.phone,
      email: form.email,
      company: form.company || null,
      nif: form.nif || null,
      notes: form.notes || null,
    });

    if (error) { toast.error(error.message); }
    else {
      toast.success("Cliente criado!");
      setForm({ name: "", phone: "", email: "", company: "", nif: "", notes: "" });
      setOpen(false);
      fetchClients();
    }
    setLoading(false);
  };

  const filtered = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.nif && c.nif.includes(search))
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">{clients.length} clientes</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Novo Cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label>Nome *</Label>
                  <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label>Empresa</Label>
                  <Input value={form.company} onChange={e => setForm({...form, company: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label>NIF</Label>
                  <Input value={form.nif} onChange={e => setForm({...form, nif: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notas</Label>
                <Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "A criar..." : "Criar Cliente"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Pesquisar clientes..." 
          value={search} 
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>NIF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  {clients.length === 0 ? "Sem clientes. Crie o primeiro!" : "Nenhum resultado."}
                </TableCell>
              </TableRow>
            ) : filtered.map(client => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">{client.name}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5 text-sm">
                    {client.phone && <span className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-muted-foreground" />{client.phone}</span>}
                    {client.email && <span className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-muted-foreground" />{client.email}</span>}
                  </div>
                </TableCell>
                <TableCell>
                  {client.company && <span className="flex items-center gap-1.5"><Building2 className="w-3 h-3 text-muted-foreground" />{client.company}</span>}
                </TableCell>
                <TableCell className="mono text-sm">{client.nif || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
