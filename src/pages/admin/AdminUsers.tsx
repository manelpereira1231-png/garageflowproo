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
import { useToast } from "@/hooks/use-toast";
import { Users, Shield } from "lucide-react";

interface ShopUserRow {
  id: string;
  user_id: string;
  shop_id: string;
  role: string;
  created_at: string;
  shop_name: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<ShopUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleDialog, setRoleDialog] = useState<{ user: ShopUserRow; newRole: string } | null>(null);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    const [usersRes, shopsRes] = await Promise.all([
      supabase.from("shop_users").select("*").order("created_at", { ascending: false }),
      supabase.from("shops").select("id, name"),
    ]);
    const shopMap = new Map<string, string>();
    (shopsRes.data || []).forEach(s => shopMap.set(s.id, s.name));

    setUsers((usersRes.data || []).map(u => ({
      ...u,
      shop_name: shopMap.get(u.shop_id) || "—",
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
      await logAction("role_changed", "shop_user", user.id, { shop: user.shop_name, from: user.role, to: newRole });
      toast({ title: `Role alterado para ${newRole}` });
      fetchUsers();
    }
    setRoleDialog(null);
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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Utilizadores & Roles</h1>
        <p className="text-sm text-muted-foreground">Gerir utilizadores e permissões em todas as oficinas ({users.length} total)</p>
      </div>

      <div className="stat-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User ID</TableHead>
              <TableHead>Oficina</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Criado</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(user => (
              <TableRow key={user.id}>
                <TableCell className="font-mono text-xs">{user.user_id.slice(0, 8)}...</TableCell>
                <TableCell className="font-medium">{user.shop_name}</TableCell>
                <TableCell>{roleBadge(user.role)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(user.created_at).toLocaleDateString("pt-PT")}
                </TableCell>
                <TableCell>
                  {user.role !== 'super_admin' && (
                    <Button variant="ghost" size="sm" onClick={() => setRoleDialog({ user, newRole: user.role })}>
                      Alterar Role
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Change Role Dialog */}
      <Dialog open={!!roleDialog} onOpenChange={() => setRoleDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Role</DialogTitle>
            <DialogDescription>
              Utilizador na oficina "{roleDialog?.user.shop_name}". Selecione o novo role.
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
    </div>
  );
}
