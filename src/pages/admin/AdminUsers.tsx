import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Users, Shield, Search, Trash2 } from "lucide-react";

interface ShopUserRow {
  id: string;
  user_id: string;
  shop_id: string;
  role: string;
  created_at: string;
  shop_name: string;
  email: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<ShopUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [roleDialog, setRoleDialog] = useState<{ user: ShopUserRow; newRole: string } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<ShopUserRow | null>(null);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    const [usersRes, shopsRes, emailsRes] = await Promise.all([
      supabase.from("shop_users").select("*").order("created_at", { ascending: false }),
      supabase.from("shops").select("id, name"),
      supabase.rpc("get_user_emails_for_admin"),
    ]);
    const shopMap = new Map<string, string>();
    (shopsRes.data || []).forEach(s => shopMap.set(s.id, s.name));

    const emailMap = new Map<string, string>();
    (emailsRes.data || []).forEach((e: any) => emailMap.set(e.user_id, e.email));

    setUsers((usersRes.data || []).map(u => ({
      ...u,
      shop_name: shopMap.get(u.shop_id) || "—",
      email: emailMap.get(u.user_id) || "—",
    })));
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const logAction = async (action: string, entityType: string, entityId: string, details: Record<string, any> = {}) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      action, entity_type: entityType, entity_id: entityId, user_id: user?.id, details,
    });
  };

  const changeRole = async () => {
    if (!roleDialog) return;
    const { user, newRole } = roleDialog;
    const { error } = await supabase.from("shop_users").update({ role: newRole }).eq("id", user.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      await logAction("role_changed", "shop_user", user.id, { shop: user.shop_name, email: user.email, from: user.role, to: newRole });
      toast({ title: `Role alterado para ${newRole}` });
      fetchUsers();
    }
    setRoleDialog(null);
  };

  const handleDeleteUser = async () => {
    if (!deleteDialog) return;
    const { error } = await supabase.from("shop_users").delete().eq("id", deleteDialog.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      await logAction("user_removed", "shop_user", deleteDialog.id, { shop: deleteDialog.shop_name, email: deleteDialog.email, role: deleteDialog.role });
      toast({ title: "Utilizador removido da oficina" });
      fetchUsers();
    }
    setDeleteDialog(null);
  };

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      super_admin: "bg-destructive/15 text-destructive border-destructive/30",
      owner: "bg-primary/15 text-primary border-primary/30",
      manager: "bg-success/15 text-success border-success/30",
      technician: "bg-muted text-muted-foreground",
    };
    return <Badge variant="outline" className={colors[role] || "bg-muted"}>{role}</Badge>;
  };

  const filtered = users.filter(u => {
    if (filterRole !== "all" && u.role !== filterRole) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!u.email.toLowerCase().includes(q) && !u.shop_name.toLowerCase().includes(q) && !u.user_id.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Stats
  const uniqueUserIds = new Set(users.map(u => u.user_id));
  const multiShopUsers = [...new Set(users.filter(u => {
    return users.filter(u2 => u2.user_id === u.user_id).length > 1;
  }).map(u => u.user_id))];

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Utilizadores & Roles</h1>
        <p className="text-sm text-muted-foreground">Gerir utilizadores e permissões em todas as oficinas ({users.length} registos, {uniqueUserIds.size} utilizadores únicos)</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card flex items-center gap-3">
          <Users className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm text-muted-foreground">Total Utilizadores</p>
            <p className="text-xl font-bold mono">{uniqueUserIds.size}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <Shield className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm text-muted-foreground">Admins / Owners</p>
            <p className="text-xl font-bold mono">{users.filter(u => u.role === 'owner' || u.role === 'super_admin').length}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <Users className="w-5 h-5 text-warning" />
          <div>
            <p className="text-sm text-muted-foreground">Multi-oficina</p>
            <p className="text-xl font-bold mono">{multiShopUsers.length}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Pesquisar email, oficina..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="technician">Technician</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="stat-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Oficina</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Criado</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(user => (
              <TableRow key={user.id}>
                <TableCell className="font-medium text-sm">{user.email}</TableCell>
                <TableCell className="text-sm">{user.shop_name}</TableCell>
                <TableCell>{roleBadge(user.role)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(user.created_at).toLocaleDateString("pt-PT")}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {user.role !== 'super_admin' && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setRoleDialog({ user, newRole: user.role })}>
                          Alterar Role
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteDialog(user)} title="Remover">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhum utilizador encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Change Role Dialog */}
      <Dialog open={!!roleDialog} onOpenChange={() => setRoleDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Role</DialogTitle>
            <DialogDescription>
              {roleDialog?.user.email} na oficina "{roleDialog?.user.shop_name}". Selecione o novo role.
            </DialogDescription>
          </DialogHeader>
          <Select value={roleDialog?.newRole || "technician"} onValueChange={v => roleDialog && setRoleDialog({ ...roleDialog, newRole: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="technician">Technician</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog(null)}>Cancelar</Button>
            <Button onClick={changeRole}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover Utilizador</DialogTitle>
            <DialogDescription>
              Remover {deleteDialog?.email} da oficina "{deleteDialog?.shop_name}"? O utilizador perderá acesso a esta oficina.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteUser}>Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
