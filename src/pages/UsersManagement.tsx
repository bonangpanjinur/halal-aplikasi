import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2, KeyRound, UserCog, Calculator } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRole {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole | null;
  owner_id?: string | null;
  commission_type?: string | null;
  monthly_salary?: number | null;
  transport_allowance?: number | null;
  target_ktp?: number | null;
  over_target_rate?: number | null;
}

const CREATABLE_ROLES: Record<AppRole, AppRole[]> = {
  super_admin: ["owner", "admin", "admin_input", "lapangan", "nib", "umkm"],
  owner: ["admin", "admin_input", "lapangan", "nib"],
  admin: ["admin_input", "lapangan", "nib"],
  admin_input: [],
  lapangan: [],
  nib: [],
  umkm: [],
};

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  owner: "Owner",
  admin: "Admin",
  admin_input: "Admin Input",
  lapangan: "Lapangan",
  nib: "NIB",
  umkm: "UMKM",
};

export default function UsersManagement() {
  const { role, user, owner_id } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [owners, setOwners] = useState<UserWithRole[]>([]);
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("admin");
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit role state
  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [editRoleUser, setEditRoleUser] = useState<UserWithRole | null>(null);
  const [editRoleValue, setEditRoleValue] = useState<AppRole>("admin");
  const [editingRole, setEditingRole] = useState(false);

  // Reset password state
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [resetPwUser, setResetPwUser] = useState<UserWithRole | null>(null);
  const [resetPwValue, setResetPwValue] = useState("");
  const [resettingPw, setResettingPw] = useState(false);

  // Commission Settings state
  const [commOpen, setCommOpen] = useState(false);
  const [commUser, setCommUser] = useState<UserWithRole | null>(null);
  const [commType, setCommType] = useState<"per_certificate" | "monthly_salary">("per_certificate");
  const [commSalary, setCommSalary] = useState(0);
  const [commTransport, setCommTransport] = useState(0);
  const [commTarget, setCommTarget] = useState(130);
  const [commOverRate, setCommOverRate] = useState(25000);
  const [savingComm, setSavingComm] = useState(false);

  const creatableRoles = useMemo(() => {
    if (!role) return [];
    return CREATABLE_ROLES[role] || [];
  }, [role]);

  const roleOptions = useMemo(() => {
    return creatableRoles.map((r) => ({ value: r, label: ROLE_LABELS[r] }));
  }, [creatableRoles]);

  const canSelectOwner = role === "super_admin" && newRole !== "owner";
  const canAccessPage = role === "super_admin" || role === "owner";

  const fetchUsers = async () => {
    if (!user) return;
    try {
      const { data: profiles, error: profilesError } = await supabase.from("profiles").select("*");
      if (profilesError) throw profilesError;
      const { data: roles, error: rolesError } = await supabase.from("user_roles").select("*");
      if (rolesError) throw rolesError;

      const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]));
      const merged: UserWithRole[] = (profiles ?? []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        role: roleMap.get(p.id) ?? null,
        owner_id: p.owner_id ?? null,
        commission_type: p.commission_type,
        monthly_salary: p.monthly_salary,
        transport_allowance: p.transport_allowance,
        target_ktp: p.target_ktp,
        over_target_rate: p.over_target_rate,
      }));

      let visibleUsers: UserWithRole[] = [];
      if (role === "super_admin") {
        visibleUsers = merged;
      } else if (role === "owner") {
        visibleUsers = merged.filter((item) => item.id === user.id || item.owner_id === user.id);
      }

      setUsers(visibleUsers.sort((a, b) => (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "")));
      setOwners(merged.filter((item) => item.role === "owner"));
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({ title: "Gagal memuat data user", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchUsers();
    const sub1 = supabase.channel("profiles-changes").on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchUsers()).subscribe();
    const sub2 = supabase.channel("roles-changes").on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => fetchUsers()).subscribe();
    return () => { sub1.unsubscribe(); sub2.unsubscribe(); };
  }, [role, user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!creatableRoles.includes(newRole)) {
      toast({ title: "Anda tidak bisa membuat role ini", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password minimal 6 karakter", variant: "destructive" });
      return;
    }
    if (canSelectOwner && !selectedOwnerId) {
      toast({ title: "Pilih owner terlebih dulu", variant: "destructive" });
      return;
    }
    setCreating(true);

    let ownerId: string | undefined;
    if (role === "owner") {
      ownerId = user.id;
    } else if (role === "super_admin") {
      ownerId = newRole === "owner" ? undefined : selectedOwnerId;
    }

    const { data, error } = await supabase.functions.invoke("create-user", {
      body: { email: newEmail, password: newPassword, full_name: newName, role: newRole, owner_id: ownerId },
    });
    setCreating(false);

    if (error || data?.error) {
      toast({ title: "Gagal membuat user", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "User Berhasil Dibuat", description: `Akun untuk ${newName} telah aktif.`, variant: "success" as any });
    setOpen(false);
    setNewEmail(""); setNewName(""); setNewPassword("");
    setNewRole(creatableRoles[0] || "admin");
    setSelectedOwnerId("");
    setTimeout(() => fetchUsers(), 300);
  };

  const handleDelete = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke("delete-user", { body: { user_id: userId } });
    if (error || data?.error) {
      toast({ title: "Gagal menghapus user", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "User Dihapus", description: "Data user telah dihapus dari sistem.", variant: "success" as any });
    fetchUsers();
  };

  const handleChangeRole = async () => {
    if (!editRoleUser) return;
    setEditingRole(true);
    const { data, error } = await supabase.functions.invoke("update-user", {
      body: { user_id: editRoleUser.id, action: "change_role", new_role: editRoleValue },
    });
    setEditingRole(false);
    if (error || data?.error) {
      toast({ title: "Gagal mengubah role", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Role Diperbarui", description: "Wewenang user telah berhasil diubah.", variant: "success" as any });
    setEditRoleOpen(false);
    setEditRoleUser(null);
    fetchUsers();
  };

  const handleResetPassword = async () => {
    if (!resetPwUser) return;
    if (resetPwValue.length < 6) {
      toast({ title: "Password minimal 6 karakter", variant: "destructive" });
      return;
    }
    setResettingPw(true);
    const { data, error } = await supabase.functions.invoke("update-user", {
      body: { user_id: resetPwUser.id, action: "reset_password", new_password: resetPwValue },
    });
    setResettingPw(false);
    if (error || data?.error) {
      toast({ title: "Gagal mereset password", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Password Direset", description: "Kata sandi user telah berhasil diperbarui.", variant: "success" as any });
    setResetPwOpen(false);
    setResetPwUser(null);
    setResetPwValue("");
  };

  const handleSaveCommission = async () => {
    if (!commUser) return;
    setSavingComm(true);
    const { error } = await supabase.from("profiles").update({
      commission_type: commType,
      monthly_salary: commSalary,
      transport_allowance: commTransport,
      target_ktp: commTarget,
      over_target_rate: commOverRate,
    } as any).eq("id", commUser.id);
    
    setSavingComm(false);
    if (error) {
      toast({ title: "Gagal menyimpan pengaturan komisi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Pengaturan Komisi Disimpan", variant: "success" as any });
    setCommOpen(false);
    setCommUser(null);
    fetchUsers();
  };

  const canEditRole = (target: UserWithRole) => {
    if (!user || target.id === user.id || target.role === "super_admin") return false;
    if (role === "super_admin") return true;
    if (role === "owner") return target.owner_id === user.id && target.role !== "owner";
    return false;
  };

  const canResetPassword = (target: UserWithRole) => {
    if (!user || target.id === user.id || target.role === "super_admin") return false;
    if (role === "super_admin") return true;
    if (role === "owner") return target.owner_id === user.id && target.role !== "owner";
    return false;
  };

  const canDeleteUser = (target: UserWithRole) => {
    if (!user || target.id === user.id || target.role === "super_admin") return false;
    if (role === "super_admin") return true;
    if (role === "owner") return target.role !== "owner" && target.owner_id === user.id;
    return false;
  };

  const roleBadgeVariant = (value: AppRole | null) => {
    switch (value) {
      case "super_admin": return "default";
      case "owner": return "default";
      case "admin": case "admin_input": return "secondary";
      default: return "outline";
    }
  };

  if (!canAccessPage) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Hanya Super Admin / Owner yang bisa mengakses halaman ini.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kelola User</h1>
        {creatableRoles.length > 0 && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Buat User</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Buat User Baru</DialogTitle>
                <DialogDescription>
                  {role === "super_admin" ? "Super admin bisa membuat owner dan user tenant." : "Owner bisa membuat user untuk timnya sendiri."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nama Lengkap</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} required maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required maxLength={255} />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={newRole} onValueChange={(value) => setNewRole(value as AppRole)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {canSelectOwner && (
                  <div className="space-y-2">
                    <Label>Owner</Label>
                    <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
                      <SelectTrigger><SelectValue placeholder="Pilih owner" /></SelectTrigger>
                      <SelectContent>
                        {owners.map((ownerItem) => (
                          <SelectItem key={ownerItem.id} value={ownerItem.id}>{ownerItem.full_name || ownerItem.email || ownerItem.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={creating}>{creating ? "Membuat..." : "Buat User"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                {role === "super_admin" && <TableHead>Owner</TableHead>}
                <TableHead className="w-32 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const ownerName = owners.find((o) => o.id === u.owner_id)?.full_name || owners.find((o) => o.id === u.owner_id)?.email || "-";
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || "-"}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell><Badge variant={roleBadgeVariant(u.role)}>{u.role ? ROLE_LABELS[u.role] : "No role"}</Badge></TableCell>
                    {role === "super_admin" && <TableCell>{u.role === "owner" ? "Tenant owner" : ownerName}</TableCell>}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEditRole(u) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Ubah Role"
                            onClick={() => {
                              setEditRoleUser(u);
                              setEditRoleValue(u.role || "admin");
                              setEditRoleOpen(true);
                            }}
                          >
                            <UserCog className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        {canResetPassword(u) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Reset Password"
                            onClick={() => {
                              setResetPwUser(u);
                              setResetPwValue("");
                              setResetPwOpen(true);
                            }}
                          >
                            <KeyRound className="h-4 w-4 text-amber-600" />
                          </Button>
                        )}
                        {(role === "owner" || role === "super_admin") && u.id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Pengaturan Komisi"
                            onClick={() => {
                              setCommUser(u);
                              setCommType((u.commission_type as any) || "per_certificate");
                              setCommSalary(u.monthly_salary || 0);
                              setCommTransport(u.transport_allowance || 0);
                              setCommTarget(u.target_ktp || 130);
                              setCommOverRate(u.over_target_rate || 25000);
                              setCommOpen(true);
                            }}
                          >
                            <Calculator className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                        {canDeleteUser(u) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Hapus User"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus User</AlertDialogTitle>
                                <AlertDialogDescription>Yakin ingin menghapus {u.full_name || u.email}? Tindakan ini tidak bisa dibatalkan.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(u.id)}>Hapus</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={role === "super_admin" ? 5 : 4} className="py-8 text-center text-muted-foreground">Belum ada user</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={editRoleOpen} onOpenChange={setEditRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah Role</DialogTitle>
            <DialogDescription>
              Ubah role untuk {editRoleUser?.full_name || editRoleUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role Saat Ini</Label>
              <Badge variant={roleBadgeVariant(editRoleUser?.role ?? null)}>
                {editRoleUser?.role ? ROLE_LABELS[editRoleUser.role] : "No role"}
              </Badge>
            </div>
            <div className="space-y-2">
              <Label>Role Baru</Label>
              <Select value={editRoleValue} onValueChange={(v) => setEditRoleValue(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {creatableRoles.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleChangeRole} className="w-full" disabled={editingRole}>
              {editingRole ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPwOpen} onOpenChange={setResetPwOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Reset password untuk {resetPwUser?.full_name || resetPwUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Password Baru</Label>
              <Input
                type="password"
                value={resetPwValue}
                onChange={(e) => setResetPwValue(e.target.value)}
                minLength={6}
                placeholder="Minimal 6 karakter"
              />
            </div>
            <Button onClick={handleResetPassword} className="w-full" disabled={resettingPw || resetPwValue.length < 6}>
              {resettingPw ? "Mereset..." : "Reset Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Commission Settings Dialog */}
      <Dialog open={commOpen} onOpenChange={setCommOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pengaturan Komisi & Gaji</DialogTitle>
            <DialogDescription>
              Atur skema pembayaran untuk {commUser?.full_name || commUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Jenis Komisi Utama</Label>
              <Select value={commType} onValueChange={(v) => setCommType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_certificate">Komisi Per Sertifikat</SelectItem>
                  <SelectItem value="monthly_salary">Gaji Per Bulan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {commType === "monthly_salary" && (
              <div className="space-y-2">
                <Label>Gaji Pokok (Rp)</Label>
                <Input type="number" value={commSalary} onChange={(e) => setCommSalary(Number(e.target.value))} />
              </div>
            )}

            <div className="space-y-2">
              <Label>Uang Transport (Rp)</Label>
              <Input type="number" value={commTransport} onChange={(e) => setCommTransport(Number(e.target.value))} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target (KTP)</Label>
                <Input type="number" value={commTarget} onChange={(e) => setCommTarget(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Bonus per KTP (Rp)</Label>
                <Input type="number" value={commOverRate} onChange={(e) => setCommOverRate(Number(e.target.value))} />
                <p className="text-[10px] text-muted-foreground italic">Diberikan jika melebihi target</p>
              </div>
            </div>

            <Button onClick={handleSaveCommission} className="w-full" disabled={savingComm}>
              {savingComm ? "Menyimpan..." : "Simpan Pengaturan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
