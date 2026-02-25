import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, UserPlus, Trash2, Shield, Wrench, Crown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
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
  manager: "bg-warning/10 text-warning border-warning/30",
  technician: "bg-info/10 text-info border-info/30",
  super_admin: "bg-destructive/10 text-destructive border-destructive/30",
};

export default function Team() {
  const { t } = useLanguage();
  const { plan, limits, shopId } = useSubscription();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
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

    if (data) {
      // We can't query auth.users, so we'll show user_id for now
      // In the future, a profiles table would solve this
      setMembers(data);
    }
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

  const canInvite = members.length < limits.maxUsers;
  const isOwner = members.some(m => m.user_id === currentUserId && m.role === 'owner');

  const handleInvite = async () => {
    if (!inviteEmail || !shopId || !isOwner) return;
    if (!canInvite) {
      toast.error(t('team.limitReached'));
      return;
    }

    setInviting(true);
    try {
      // Check if user already exists in auth by trying to find them
      // We'll create a shop_user entry - the user needs to sign up first
      // For now, send an invite email with a signup link
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
      toast.error(t('team.inviteError'));
      console.error("Invite error:", err);
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string, memberUserId: string) => {
    if (memberUserId === currentUserId) {
      toast.error(t('team.cantRemoveSelf'));
      return;
    }
    const { error } = await supabase.from("shop_users").delete().eq("id", memberId);
    if (error) toast.error(error.message);
    else {
      toast.success(t('team.memberRemoved'));
      fetchMembers();
    }
  };

  const handleRoleChange = async (memberId: string, memberUserId: string, newRole: string) => {
    if (memberUserId === currentUserId) return;
    const { error } = await supabase.from("shop_users").update({ role: newRole }).eq("id", memberId);
    if (error) toast.error(error.message);
    else {
      toast.success(t('team.roleUpdated'));
      fetchMembers();
    }
  };

  // Free plan: show upgrade message
  if (plan === 'free') {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">{t('team.title')}</h1>
        </div>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground mb-4">{t('team.disabledFree')}</p>
          <Link to="/billing">
            <Button>{t('nav.billing')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">{t('team.title')}</h1>
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
              <DialogHeader>
                <DialogTitle>{t('team.inviteTitle')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="tecnico@oficina.pt"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('team.roleLabel')}</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">{t('team.role.manager')}</SelectItem>
                      <SelectItem value="technician">{t('team.role.technician')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!canInvite && (
                  <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 p-3 rounded-lg">
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

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('team.memberCol')}</TableHead>
              <TableHead>{t('team.roleCol')}</TableHead>
              <TableHead>{t('team.joinedCol')}</TableHead>
              {isOwner && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  {t('common.loading')}
                </TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  {t('team.empty')}
                </TableCell>
              </TableRow>
            ) : members.map(m => {
              const RoleIcon = roleIcons[m.role] || Users;
              const isCurrentUser = m.user_id === currentUserId;
              return (
                <TableRow key={m.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <RoleIcon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium font-mono">
                          {m.user_id.slice(0, 8)}...
                          {isCurrentUser && <span className="ml-2 text-xs text-primary">({t('team.you')})</span>}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isOwner && !isCurrentUser && m.role !== 'owner' ? (
                      <Select value={m.role} onValueChange={v => handleRoleChange(m.id, m.user_id, v)}>
                        <SelectTrigger className="w-[140px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manager">{t('team.role.manager')}</SelectItem>
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
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(m.id, m.user_id)}
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
      </div>
    </div>
  );
}