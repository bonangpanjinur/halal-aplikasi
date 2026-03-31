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
  const { role, user } = useAuth();
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
  const [editRoleOwnerValue, setEditRoleOwnerValue] = useState<string>("");
  const [editingRole, setEditingRole] = useState(false);

  // Edit owner state
  const [editOwnerOpen, setEditOwnerOpen] = useState(false);
  const [editOwnerUser, setEditOwnerUser] = useState<UserWithRole | null>(null);
  const [editOwnerValue, setEditOwnerValue] = useState<string>("");
  const [editingOwner, setEditingOwner] = useState(false);

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
    
    const isManagedRole = ["admin", "admin_input", "lapangan", "nib", "umkm"].includes(editRoleValue);
    if (role === "super_admin" && isManagedRole && !editRoleOwnerValue && (!editRoleUser.owner_id || editRoleUser.owner_id === editRoleUser.id)) {
      toast({ title: "Pilih owner terlebih dulu", variant: "destructive" });
      return;
    }

    setEditingRole(true);
    const { data, error } = await supabase.functions.invoke("update-user", {
      body: { 
        user_id: editRoleUser.id, 
        action: "change_role", 
        new_role: editRoleValue,
        new_owner_id: (role === "super_admin" && isManagedRole) ? editRoleOwnerValue : undefined
      },
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

  const handleChangeOwner = async () => {
    if (!editOwnerUser) return;
    setEditingOwner(true);
    const { data, error } = await supabase.functions.invoke("update-user", {
      body: { user_id: editOwnerUser.id, action: "change_owner", new_owner_id: editOwnerValue === "none" ? null : editOwnerValue },
    });
    setEditingOwner(false);
    if (error || data?.error) {
      toast({ title: "Gagal mengubah owner", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Owner Diperbarui", description: "Owner user telah berhasil diubah.", variant: "success" as any });
    setEditOwnerOpen(false);
    setEditOwnerUser(null);
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
    const updateData: any = {
      commission_type: commType,
      monthly_salary: commSalary,
      transport_allowance: commTransport,
      target_ktp: commTarget,
      over_target_rate: commOverRate,
    };

    // If current user is an owner, ensure the managed user is under them
    if (role === "owner" && user) {
      updateData.owner_id = user.id;
    }

    const { error } = await supabase.from("profiles").update(updateData).eq("id", commUser.id);
    
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

  const canEditOwner = (target: UserWithRole) => {
    if (!user || target.id === user.id || target.role === "super_admin" || target.role === "owner") return false;
    return role === "super_admin";
  };

  const canResetPassword = (target: UserWithRole) => {
    if (!user || target.id === user.id || target.role === "super_admin") return false;
    if (role === "super_admin") return true;
    if (role === "owner") return target.owner_id === user.id;
    return false;
  };

  const canDelete = (target: UserWithRole) => {
    if (!user || target.id === user.id || target.role === "super_admin") return false;
    if (role === "super_admin") return true;
    if (role === "owner") return target.owner_id === user.id;
    return false;
  };

  const getBonusLabel = () => {
    if (!commUser) return "Bonus";
    const userRole = commUser.role;
    if (userRole === "admin_input") return "Bonus per Sertifikat";
    if (userRole === "lapangan" || userRole === "nib") return "Bonus per KTP";
    return "Bonus";
  };

  const getTargetLabel = () => {
    if (!commUser) return "Target";
    const userRole = commUser.role;
    if (userRole === "admin_input") return "Target (Sertifikat)";
    if (userRole === "lapangan" || userRole === "nib") return "Target (KTP)";
    return "Target";
  };

  const roleBadgeVariant = (r: AppRole | null) => {
    if (r === "super_admin") return "destructive";
    if (r === "owner") return "default";
    return "secondary";
  };

  if (!canAccessPage) return <div className="p-8 text-center">Akses Ditolak</div>;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Kelola User</h1>
          <p className="text-muted-foreground">Manajemen akun dan wewenang pengguna sistem.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Tambah User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah User Baru</DialogTitle>
              <DialogDescription>Buat akun baru untuk anggota tim Anda.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Lengkap</Label>
                <Input id="name" value={newName} onChange={(e) => setNewName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {canSelectOwner && (
                <div className="space-y-2">
                  <Label>Owner</Label>
                  <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
                    <SelectTrigger><SelectValue placeholder="Pilih Owner" /></SelectTrigger>
                    <SelectContent>
                      {owners.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.full_name || o.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? "Memproses..." : "Buat Akun"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
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
                <TableHead className="text-right">Aksi</TableHead>
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
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditRoleUser(u);
                              setEditRoleValue(u.role || "admin");
                              setEditRoleOwnerValue(u.owner_id || "");
                              setEditRoleOpen(true);
                            }}
                          >
                            <UserCog className="h-4 w-4 mr-1" />
                            Role
                          </Button>
                        )}
                        {canEditOwner(u) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditOwnerUser(u);
                              setEditOwnerValue(u.owner_id || "none");
                              setEditOwnerOpen(true);
                            }}
                          >
                            <UserCog className="h-4 w-4 mr-1" />
                            Owner
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
                        {canDelete(u) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Hapus User">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus User?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tindakan ini tidak dapat dibatalkan. Akun {u.full_name} akan dihapus permanen.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(u.id)} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={editRoleOpen} onOpenChange={setEditRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah Role User</DialogTitle>
            <DialogDescription>Pilih wewenang baru untuk user {editRoleUser?.full_name || editRoleUser?.email}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pilih Role</Label>
              <Select value={editRoleValue} onValueChange={(v) => setEditRoleValue(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {role === "super_admin" && ["admin", "admin_input", "lapangan", "nib", "umkm"].includes(editRoleValue) && (
              <div className="space-y-2">
                <Label>Pilih Owner</Label>
                <Select value={editRoleOwnerValue} onValueChange={setEditRoleOwnerValue}>
                  <SelectTrigger><SelectValue placeholder="Pilih Owner" /></SelectTrigger>
                  <SelectContent>
                    {owners.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.full_name || o.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button className="w-full" onClick={handleChangeRole} disabled={editingRole}>
              {editingRole ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Owner Dialog */}
      <Dialog open={editOwnerOpen} onOpenChange={setEditOwnerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah Owner User</DialogTitle>
            <DialogDescription>
              Pilih owner baru untuk user {editOwnerUser?.full_name || editOwnerUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pilih Owner</Label>
              <Select value={editOwnerValue} onValueChange={setEditOwnerValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tanpa Owner</SelectItem>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.full_name || o.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              className="w-full" 
              onClick={handleChangeOwner}
              disabled={editingOwner}
            >
              {editingOwner ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPwOpen} onOpenChange={setResetPwOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Masukkan kata sandi baru untuk {resetPwUser?.full_name || resetPwUser?.email}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-pw">Password Baru</Label>
              <Input id="new-pw" type="password" value={resetPwValue} onChange={(e) => setResetPwValue(e.target.value)} placeholder="Minimal 6 karakter" />
            </div>
            <Button className="w-full" onClick={handleResetPassword} disabled={resettingPw}>
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
            <DialogDescription>Atur skema pembayaran untuk {commUser?.full_name || commUser?.email}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipe Pembayaran</Label>
              <Select value={commType} onValueChange={(v: any) => setCommType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_certificate">Komisi</SelectItem>
                  <SelectItem value="monthly_salary">Gaji</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {commType === "monthly_salary" ? (
              <>
                <div className="space-y-2">
                  <Label>Gaji Pokok (Rp)</Label>
                  <Input type="number" value={commSalary} onChange={(e) => setCommSalary(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Uang Transport / Hari (Rp)</Label>
                  <Input type="number" value={commTransport} onChange={(e) => setCommTransport(Number(e.target.value))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{getTargetLabel()}</Label>
                    <Input type="number" value={commTarget} onChange={(e) => setCommTarget(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{getBonusLabel()} (Rp)</Label>
                    <Input type="number" value={commOverRate} onChange={(e) => setCommOverRate(Number(e.target.value))} />
                  </div>
                </div>
                {commUser && (commUser.role === "lapangan" || commUser.role === "nib") && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-900 dark:text-blue-100">
                    💡 Diberikan jika melebihi target KTP
                  </div>
                )}
                {commUser && commUser.role === "admin_input" && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-900 dark:text-blue-100">
                    💡 Bonus per sertifikat yang diproses
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 bg-muted rounded-lg text-sm">
                User akan dibayar berdasarkan komisi per sertifikat yang diatur di pengaturan aplikasi.
              </div>
            )}

            <Button className="w-full" onClick={handleSaveCommission} disabled={savingComm}>
              {savingComm ? "Menyimpan..." : "Simpan Pengaturan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
