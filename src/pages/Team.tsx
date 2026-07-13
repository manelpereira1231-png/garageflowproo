import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Users, UserPlus, Trash2, Shield, Wrench, Crown, AlertTriangle, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { sendEmail, inviteUserEmailHtml } from "@/lib/emailService";

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  email?: string;
}

const roleIcons: Record<string, React.ElementType> = {
  owner: Crown,
  manager: Shield,
  technician: Wrench,
};

const roleBadgeStyles: Record<string, string> = {
  owner: "bg-primary/10 text-primary border-primary/30",
  manager: "bg-yellow-500/10 text-yellow-700 border-yellow-300 dark:text-yellow-400",
  technician: "bg-blue-500/10 text-blue-700 border-blue-300 dark:text-blue-400",
  super_admin: "bg-destructive/10 text-destructive border-destructive/30",
};

export default function Team() {
  const { t } = useLanguage();
  const { limits, shopId, loading: subLoading } = useSubscription();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<{ id: string; userId: string } | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("technician");
  const [inviting, setInviting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [shopName, setShopName] = useState("");

  const fetchMembers = async () => {
    if (!shopId) return;
    const { data } = await supabase
      .from("shop_users")
      .select("id, user_id, role, created_at")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: true });
    if (!data) { setLoading(false); return; }

    // Resolve emails via RPC
    const { data: emailData } = await supabase.rpc("get_shop_member_emails", { _shop_id: shopId });
    const emailMap = new Map((emailData || []).map((e: any) => [e.user_id, e.email]));
    
    setMembers(data.map(m => ({ ...m, email: emailMap.get(m.user_id) || undefined })));
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
      if (shopId) {
        const { data: shop } = await supabase.from("shops").select("name").eq("id", shopId).single();
        if (shop) setShopName(shop.name);
      }
      fetchMembers();
    };
    init();
  }, [shopId]);

  const teamEnabled = limits.teamManagement === true;
  const canInvite = teamEnabled && members.length < limits.maxUsers;
  const isOwner = members.some(m => m.user_id === currentUserId && m.role === 'owner');
  const ownerCount = members.filter(m => m.role === 'owner').length;
  const managerCount = members.filter(m => m.role === 'manager').length;
  const techCount = members.filter(m => m.role === 'technician').length;

  const handleInvite = async () => {
    if (!inviteEmail || !shopId || !isOwner) return;
    if (!teamEnabled) {
      toast.error("Gestão de equipa disponível apenas nos planos Pro e Garage.");
      return;
    }
    if (!canInvite) { toast.error(t('team.limitReached')); return; }

    setInviting(true);
    try {
      const signupUrl = `${window.location.origin}`;
      await sendEmail({
        to: inviteEmail,
        subject: `${t('team.inviteSubject')} — ${shopName}`,
        html: inviteUserEmailHtml(signupUrl, shopName, t(`team.role.${inviteRole}`)),
      });
      toast.success(t('team.inviteSent'));
      setInviteEmail("");
      setInviteOpen(false);
    } catch (err: any) {
      // Mostrar a mensagem real (útil para diagnosticar edge function / domínio de email)
      const msg = err?.message || t('team.inviteError');
      toast.error(msg.length > 140 ? msg.slice(0, 140) + '…' : msg);
      console.error("Team invite failed:", err);
    } finally {
      setInviting(false);
    }
  };

  const handleForceLogout = async (targetUserId: string) => {
    if (!shopId) return;
    const { error } = await supabase.rpc("admin_force_logout", {
      _shop_id: shopId,
      _target_user_id: targetUserId,
    });
    if (error) toast.error(error.message);
    else toast.success("Sessão do colaborador terminada.");
  };

  const handleRequirePasswordReset = async (targetUserId: string) => {
    if (!shopId) return;
    const { error } = await supabase.rpc("admin_require_password_reset", {
      _shop_id: shopId,
      _target_user_id: targetUserId,
    });
    if (error) toast.error(error.message);
    else toast.success("Colaborador terá que definir nova password.");
  };

  const handleRemove = async (memberId: string) => {
    const { error } = await supabase.from("shop_users").delete().eq("id", memberId);
    if (error) toast.error(error.message);
    else { toast.success(t('team.memberRemoved')); fetchMembers(); }
    setRemoveConfirm(null);
  };

  const handleRoleChange = async (memberId: string, memberUserId: string, newRole: string) => {
    if (memberUserId === currentUserId) return;
    const { error } = await supabase.from("shop_users").update({ role: newRole }).eq("id", memberId);
    if (error) toast.error(error.message);
    else { toast.success(t('team.roleUpdated')); fetchMembers(); }
  };

  if (subLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            {t('team.title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {members.length}/{limits.maxUsers === Infinity ? '∞' : limits.maxUsers} {t('team.members')}
          </p>
        </div>
        {isOwner && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" disabled={!canInvite}>
                <UserPlus className="w-4 h-4" />
                {t('team.invite')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t('team.inviteTitle')}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="tecnico@oficina.pt" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('team.roleLabel')}</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2"><Shield className="w-4 h-4" />Administrador</div>
                      </SelectItem>
                      <SelectItem value="manager">
                        <div className="flex items-center gap-2"><Shield className="w-4 h-4" />{t('team.role.manager')}</div>
                      </SelectItem>
                      <SelectItem value="reception">
                        <div className="flex items-center gap-2"><Users className="w-4 h-4" />Receção</div>
                      </SelectItem>
                      <SelectItem value="commercial">
                        <div className="flex items-center gap-2"><Users className="w-4 h-4" />Comercial</div>
                      </SelectItem>
                      <SelectItem value="technician">
                        <div className="flex items-center gap-2"><Wrench className="w-4 h-4" />{t('team.role.technician')}</div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    {inviteRole === 'admin' && 'Acesso quase total — exceto transferir propriedade.'}
                    {inviteRole === 'manager' && t('team.roleDescManager')}
                    {inviteRole === 'reception' && 'Receção — clientes, veículos, orçamentos, ordens e agenda. Sem dados financeiros.'}
                    {inviteRole === 'commercial' && 'Comercial — clientes, leads e orçamentos. Sem stock nem financeiro.'}
                    {inviteRole === 'technician' && t('team.roleDescTechnician')}
                  </p>
                </div>
                {!canInvite && (
                  <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400 p-3 rounded-lg">
                    <AlertTriangle className="w-4 h-4" />
                    {t('team.limitReached')}
                  </div>
                )}
                <Button onClick={handleInvite} disabled={inviting || !inviteEmail || !canInvite} className="w-full">
                  {inviting ? t('common.loading') : t('team.sendInvite')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Team summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('team.totalMembers'), value: members.length, icon: Users, color: "text-primary" },
          { label: t('team.role.owner'), value: ownerCount, icon: Crown, color: "text-primary" },
          { label: t('team.role.manager'), value: managerCount, icon: Shield, color: "text-yellow-500" },
          { label: t('team.role.technician'), value: techCount, icon: Wrench, color: "text-blue-500" },
        ].map((kpi, i) => (
          <Card key={i}>
            <CardContent className="pt-3 pb-2 px-4">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Members table - Desktop */}
      <Card className="hidden sm:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('team.memberCol')}</TableHead>
                <TableHead>{t('team.roleCol')}</TableHead>
                <TableHead>{t('team.joinedCol')}</TableHead>
                {isOwner && <TableHead className="w-[80px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t('common.loading')}</TableCell>
                </TableRow>
              ) : members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t('team.empty')}</TableCell>
                </TableRow>
              ) : members.map(m => {
                const RoleIcon = roleIcons[m.role] || Users;
                const isCurrentUser = m.user_id === currentUserId;
                return (
                  <TableRow key={m.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                          m.role === 'owner' ? 'bg-primary/10' : m.role === 'manager' ? 'bg-yellow-500/10' : 'bg-blue-500/10'
                        }`}>
                          <RoleIcon className={`w-4 h-4 ${
                            m.role === 'owner' ? 'text-primary' : m.role === 'manager' ? 'text-yellow-600' : 'text-blue-600'
                          }`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {m.email || `${m.user_id.slice(0, 8)}...`}
                          </p>
                          {isCurrentUser && <Badge variant="outline" className="text-[9px] px-1 py-0 mt-0.5">{t('team.you')}</Badge>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isOwner && !isCurrentUser && m.role !== 'owner' ? (
                        <Select value={m.role} onValueChange={v => handleRoleChange(m.id, m.user_id, v)}>
                          <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="manager">{t('team.role.manager')}</SelectItem>
                            <SelectItem value="reception">Receção</SelectItem>
                            <SelectItem value="commercial">Comercial</SelectItem>
                            <SelectItem value="technician">{t('team.role.technician')}</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={roleBadgeStyles[m.role] || ''}>
                          {t(`team.role.${m.role}`)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString()}
                    </TableCell>
                    {isOwner && (
                      <TableCell>
                        {!isCurrentUser && m.role !== 'owner' && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => setRemoveConfirm({ id: m.id, userId: m.user_id })}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Members cards - Mobile */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">{t('team.empty')}</div>
        ) : members.map(m => {
          const RoleIcon = roleIcons[m.role] || Users;
          const isCurrentUser = m.user_id === currentUserId;
          return (
            <div key={m.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  m.role === 'owner' ? 'bg-primary/10' : m.role === 'manager' ? 'bg-yellow-500/10' : 'bg-blue-500/10'
                }`}>
                  <RoleIcon className={`w-5 h-5 ${
                    m.role === 'owner' ? 'text-primary' : m.role === 'manager' ? 'text-yellow-600' : 'text-blue-600'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {m.email || `${m.user_id.slice(0, 8)}...`}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className={`text-[10px] ${roleBadgeStyles[m.role] || ''}`}>
                      {t(`team.role.${m.role}`)}
                    </Badge>
                    {isCurrentUser && <Badge variant="outline" className="text-[9px] px-1 py-0">{t('team.you')}</Badge>}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</span>
                <div className="flex gap-2">
                  {isOwner && !isCurrentUser && m.role !== 'owner' && (
                    <>
                      <Select value={m.role} onValueChange={v => handleRoleChange(m.id, m.user_id, v)}>
                        <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manager">{t('team.role.manager')}</SelectItem>
                          <SelectItem value="technician">{t('team.role.technician')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => setRemoveConfirm({ id: m.id, userId: m.user_id })}
                        className="text-destructive hover:text-destructive h-8 w-8 p-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Remove Confirmation */}
      <Dialog open={!!removeConfirm} onOpenChange={() => setRemoveConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('team.removeConfirm')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t('team.removeConfirmMsg')}</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRemoveConfirm(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={() => removeConfirm && handleRemove(removeConfirm.id)}>{t('common.delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
