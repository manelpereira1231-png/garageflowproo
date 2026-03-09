import { useEffect, useState, useCallback } from "react";
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
import { Users, Shield, Search, Trash2, MailCheck, Loader2, Download, Building2, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  const [confirmingEmail, setConfirmingEmail] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchUsers = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchUsers();

    // Realtime: auto-refresh on shop_users changes
    const channel = supabase
      .channel("admin-users-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "shop_users" }, () => fetchUsers())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchUsers]);

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
    }
    setDeleteDialog(null);
  };

  const handleConfirmEmail = async (userId: string, email: string) => {
    setConfirmingEmail(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-confirm-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ user_id: userId }),
        }
      );
      const result = await res.json();
      if (result.error) {
        toast({ title: "Erro", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Email confirmado", description: `O email ${email} foi confirmado com sucesso.` });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setConfirmingEmail(null);
  };

  const exportCSV = () => {
    const headers = ["Email", "Oficina", "Role", "User ID", "Criado em"];
    const rows = filtered.map(u => [
      u.email, u.shop_name, u.role, u.user_id,
      new Date(u.created_at).toLocaleDateString("pt-PT"),
    ]);
    const csv = [headers.join(";"), ...rows.map(r => r.map(c => `"${c}"`).join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
  const roleBreakdown = {
    owners: users.filter(u => u.role === 'owner').length,
    managers: users.filter(u => u.role === 'manager').length,
    technicians: users.filter(u => u.role === 'technician').length,
    superAdmins: users.filter(u => u.role === 'super_admin').length,
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Utilizadores & Roles</h1>
          <p className="text-sm text-muted-foreground">Gerir utilizadores em todas as oficinas · {users.length} registos · {uniqueUserIds.size} únicos · Tempo real</p>
        </div>
        <Button onClick={exportCSV} variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="stat-card flex items-center gap-3">
          <Users className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground">Total Únicos</p>
            <p className="text-lg font-bold mono">{uniqueUserIds.size}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <Shield className="w-5 h-5 text-destructive flex-shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground">Super Admins</p>
            <p className="text-lg font-bold mono">{roleBreakdown.superAdmins}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <Shield className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground">Owners</p>
            <p className="text-lg font-bold mono">{roleBreakdown.owners}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <Users className="w-5 h-5 text-success flex-shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground">Managers</p>
            <p className="text-lg font-bold mono">{roleBreakdown.managers}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <Users className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground">Technicians</p>
            <p className="text-lg font-bold mono">{roleBreakdown.technicians}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <Building2 className="w-5 h-5 text-warning flex-shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground">Multi-oficina</p>
            <p className="text-lg font-bold mono">{multiShopUsers.length}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Pesquisar email, oficina, ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
              <TableHead>User ID</TableHead>
              <TableHead>Criado</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(user => (
              <TableRow key={user.id}>
                <TableCell className="font-medium text-sm">{user.email}</TableCell>
                <TableCell>
                  <button
                    onClick={() => navigate(`/admin/shops/${user.shop_id}`)}
                    className="text-sm text-primary hover:underline"
                  >
                    {user.shop_name}
                  </button>
                </TableCell>
                <TableCell>{roleBadge(user.role)}</TableCell>
                <TableCell className="text-[10px] text-muted-foreground font-mono max-w-[120px] truncate">{user.user_id}</TableCell>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleConfirmEmail(user.user_id, user.email)}
                          disabled={confirmingEmail === user.user_id}
                          title="Confirmar email deste utilizador"
                          className="text-green-600 hover:text-green-700"
                        >
                          {confirmingEmail === user.user_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <MailCheck className="w-4 h-4" />
                          )}
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
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
