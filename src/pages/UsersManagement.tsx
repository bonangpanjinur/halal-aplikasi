import { useEffect, useMemo, useState, useCallback } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  Plus, 
  Trash2, 
  KeyRound, 
  UserCog, 
  Calculator, 
  ShieldCheck, 
  Loader2, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  MoreHorizontal,
  CheckCircle2
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRole {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole | null;
  owner_id?: string | null;
  ccommission_type?: string | null;
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
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Create user state
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

  // Ccommission Settings state
  const [commOpen, setCommOpen] = useState(false);
  const [commUser, setCommUser] = useState<UserWithRole | null>(null);
  const [commType, setCommType] = useState<"per_certificate" | "monthly_salary">("per_certificate");
  const [commSalary, setCommSalary] = useState(0);
  const [commTransport, setCommTransport] = useState(0);
  const [commTarget, setCommTarget] = useState(130);
  const [commOverRate, setCommOverRate] = useState(25000);
  const [savingComm, setSavingComm] = useState(false);

  // Access Settings state
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessUser, setAccessUser] = useState<UserWithRole | null>(null);
  const [userAccess, setUserAccess] = useState<Record<string, { can_view: boolean; can_edit: boolean }>>({});
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);

  const creatableRoles = useMemo(() => {
    if (!role) return [];
    return CREATABLE_ROLES[role] || [];
  }, [role]);

  const roleOptions = useMemo(() => {
    return creatableRoles.map((r) => ({ value: r, label: ROLE_LABELS[r] }));
  }, [creatableRoles]);

  const canSelectOwner = role === "super_admin" && newRole !== "owner";

  const fetchUsers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (owners.length === 0) {
        const { data: ownerProfiles } = await supabase
          .from("user_roles")
          .select("user_id, profiles(id, full_name, email)")
          .eq("role", "owner");
        
        const ownerList = (ownerProfiles || []).map((op: any) => ({
          id: op.profiles.id,
          full_name: op.profiles.full_name,
          email: op.profiles.email,
          role: "owner" as AppRole
        }));
        setOwners(ownerList);
      }

      let query = supabase
        .from("profiles")
        .select(`
          *,
          user_roles!inner(role)
        `, { count: "exact" });

      if (role === "owner") {
        query = query.or(`id.eq.${user.id},owner_id.eq.${user.id}`);
      }

      if (filterRole !== "all") {
        query = query.eq("user_roles.role", filterRole);
      }

      if (filterOwner !== "all") {
        query = query.eq("owner_id", filterOwner);
      }

      if (searchQuery) {
        query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      const { data, count, error } = await query
        .order("full_name", { ascending: true })
        .range(from, to);

      if (error) throw error;

      const merged: UserWithRole[] = (data || []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        role: p.user_roles[0]?.role ?? null,
        owner_id: p.owner_id ?? null,
        ccommission_type: p.ccommission_type,
        monthly_salary: p.monthly_salary,
        transport_allowance: p.transport_allowance,
        target_ktp: p.target_ktp,
        over_target_rate: p.over_target_rate,
      }));

      setUsers(merged);
      setTotalCount(count || 0);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({ title: "Gagal memuat data user", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, role, page, pageSize, searchQuery, filterRole, filterOwner]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

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
    fetchUsers();
  };

  const handleDelete = async (userIds: string | string[]) => {
    const ids = Array.isArray(userIds) ? userIds : [userIds];
    const { data, error } = await supabase.functions.invoke("delete-user", { body: { user_id: ids } });
    if (error || data?.error) {
      toast({ title: "Gagal menghapus user", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "User Dihapus", description: data.message || "Data user telah dihapus dari sistem.", variant: "success" as any });
    setSelectedIds([]);
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
      body: { 
        user_id: editOwnerUser.id, 
        action: "change_owner", 
        new_owner_id: editOwnerValue === "none" ? null : editOwnerValue 
      },
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
    if (!resetPwUser || resetPwValue.length < 6) {
      toast({ title: "Password minimal 6 karakter", variant: "destructive" });
      return;
    }
    setResettingPw(true);
    const { data, error } = await supabase.functions.invoke("update-user", {
      body: { user_id: resetPwUser.id, action: "reset_password", new_password: resetPwValue },
    });
    setResettingPw(false);
    if (error || data?.error) {
      toast({ title: "Gagal reset password", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Password Berhasil Direset", description: "User dapat login dengan password baru.", variant: "success" as any });
    setResetPwOpen(false);
    setResetPwValue("");
    setResetPwUser(null);
  };

  const handleSaveCcommission = async () => {
    if (!commUser) return;
    setSavingComm(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        ccommission_type: commType,
        monthly_salary: commSalary,
        transport_allowance: commTransport,
        target_ktp: commTarget,
        over_target_rate: commOverRate,
      })
      .eq("id", commUser.id);
    setSavingComm(false);
    if (error) {
      toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Pengaturan Disimpan", description: "Data komisi dan gaji telah diperbarui.", variant: "success" as any });
    setCommOpen(false);
    fetchUsers();
  };

  const fetchUserAccess = async (userId: string, userRole: string) => {
    setLoadingAccess(true);
    try {
      const { data, error } = await supabase.from("user_access_controls").select("*").eq("user_id", userId);
      if (error) throw error;
      const map: Record<string, { can_view: boolean; can_edit: boolean }> = {};
      data?.forEach((item) => { map[item.field_key] = { can_view: item.can_view, can_edit: item.can_edit }; });
      setUserAccess(map);
    } catch (error) {
      console.error("Error fetching access:", error);
    } finally {
      setLoadingAccess(false);
    }
  };

  const handleToggleAccess = (fieldKey: string, type: "can_view" | "can_edit") => {
    setUserAccess((prev) => {
      const current = prev[fieldKey] || { can_view: true, can_edit: true };
      const nextValue = !current[type];
      const next = { ...current, [type]: nextValue };
      if (type === "can_edit" && nextValue && !next.can_view) next.can_view = true;
      if (type === "can_view" && !nextValue && next.can_edit) next.can_edit = false;
      return { ...prev, [fieldKey]: next };
    });
  };

  const handleSaveAccess = async () => {
    if (!accessUser) return;
    setSavingAccess(true);
    try {
      const payloads = Object.entries(userAccess).map(([key, val]) => ({
        user_id: accessUser.id,
        field_key: key,
        can_view: val.can_view,
        can_edit: val.can_edit,
      }));
      const { error: deleteError } = await supabase.from("user_access_controls").delete().eq("user_id", accessUser.id);
      if (deleteError) throw deleteError;
      if (payloads.length > 0) {
        const { error: insertError } = await supabase.from("user_access_controls").insert(payloads);
        if (insertError) throw insertError;
      }
      toast({ title: "Akses Diperbarui", variant: "success" as any });
      setAccessOpen(false);
    } catch (error: any) {
      toast({ title: "Gagal menyimpan akses", description: error.message, variant: "destructive" });
    } finally {
      setSavingAccess(false);
    }
  };

  const roleBadgeVariant = (r: AppRole | null) => {
    switch (r) {
      case "super_admin": return "destructive";
      case "owner": return "default";
      case "admin": return "secondary";
      case "umkm": return "outline";
      default: return "outline";
    }
  };

  const canEditRole = (u: UserWithRole) => {
    if (!role) return false;
    if (u.id === user?.id) return false;
    if (role === "super_admin") return true;
    if (role === "owner" && u.owner_id === user?.id) return true;
    return false;
  };

  const canEditOwner = (u: UserWithRole) => role === "super_admin" && u.role !== "super_admin" && u.role !== "owner";
  const canResetPassword = (u: UserWithRole) => canEditRole(u);
  const canDelete = (u: UserWithRole) => canEditRole(u);

  const toggleSelectAll = () => {
    if (selectedIds.length === users.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(users.map(u => u.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kelola User</h1>
          <p className="text-muted-foreground">Atur wewenang, owner, dan akses data untuk setiap pengguna.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-sm">
              <Plus className="mr-2 h-4 w-4" /> Tambah User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah User Baru</DialogTitle>
              <DialogDescription>Akun akan langsung aktif setelah dibuat.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Lengkap</Label>
                <Input id="name" value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="Masukkan nama lengkap" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required placeholder="nama@email.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="Minimal 6 karakter" />
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
                  <Label>Pilih Owner</Label>
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
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {creating ? "Memproses..." : "Buat Akun"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 flex flex-col gap-4 md:flex-row md:items-center bg-muted/30 border-b">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Cari nama atau email..." 
                className="pl-9 bg-background" 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filterRole} onValueChange={(v) => { setFilterRole(v); setPage(1); }}>
                <SelectTrigger className="w-[140px] bg-background">
                  <Filter className="mr-2 h-3 w-3" />
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Role</SelectItem>
                  {Object.entries(ROLE_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {role === "super_admin" && (
                <Select value={filterOwner} onValueChange={(v) => { setFilterOwner(v); setPage(1); }}>
                  <SelectTrigger className="w-[180px] bg-background">
                    <UserCog className="mr-2 h-3 w-3" />
                    <SelectValue placeholder="Owner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Owner</SelectItem>
                    {owners.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.full_name || o.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-[100px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / hal</SelectItem>
                  <SelectItem value="25">25 / hal</SelectItem>
                  <SelectItem value="50">50 / hal</SelectItem>
                  <SelectItem value="100">100 / hal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="p-2 px-4 bg-primary/5 border-b flex items-center justify-between animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {selectedIds.length} user terpilih
              </div>
              <div className="flex items-center gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" /> Hapus Terpilih
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hapus {selectedIds.length} User?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tindakan ini tidak dapat dibatalkan. Semua data terkait user yang dipilih akan dihapus secara permanen.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(selectedIds)} className="bg-destructive text-destructive-foreground">Hapus Semua</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>Batal</Button>
              </div>
            </div>
          )}

          <div className="relative overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox 
                      checked={users.length > 0 && selectedIds.length === users.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  {role === "super_admin" && <TableHead>Owner</TableHead>}
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: pageSize }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><div className="h-4 w-4 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-48 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-6 w-20 bg-muted animate-pulse rounded-full" /></TableCell>
                      {role === "super_admin" && <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>}
                      <TableCell><div className="h-8 w-8 ml-auto bg-muted animate-pulse rounded" /></TableCell>
                    </TableRow>
                  ))
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={role === "super_admin" ? 6 : 5} className="h-32 text-center text-muted-foreground">
                      Tidak ada user ditemukan.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => {
                    const owner = owners.find((o) => o.id === u.owner_id);
                    const ownerName = owner?.full_name || owner?.email || "-";
                    return (
                      <TableRow key={u.id} className={selectedIds.includes(u.id) ? "bg-primary/5" : ""}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedIds.includes(u.id)}
                            onCheckedChange={() => toggleSelect(u.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{u.full_name || "-"}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell><Badge variant={roleBadgeVariant(u.role)}>{u.role ? ROLE_LABELS[u.role] : "No role"}</Badge></TableCell>
                        {role === "super_admin" && <TableCell>{u.role === "owner" ? <span className="text-xs text-muted-foreground italic">Tenant owner</span> : ownerName}</TableCell>}
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[200px]">
                              <DropdownMenuLabel>Aksi User</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              
                              {canEditRole(u) && (
                                <DropdownMenuItem onClick={() => {
                                  setEditRoleUser(u);
                                  setEditRoleValue(u.role || "admin");
                                  setEditRoleOwnerValue(u.owner_id || "");
                                  setEditRoleOpen(true);
                                }}>
                                  <UserCog className="h-4 w-4 mr-2" /> Ubah Role
                                </DropdownMenuItem>
                              )}

                              {canEditOwner(u) && (
                                <DropdownMenuItem onClick={() => {
                                  setEditOwnerUser(u);
                                  setEditOwnerValue(u.owner_id || "none");
                                  setEditOwnerOpen(true);
                                }}>
                                  <UserCog className="h-4 w-4 mr-2" /> Pindahkan Owner
                                </DropdownMenuItem>
                              )}

                              {canResetPassword(u) && (
                                <DropdownMenuItem onClick={() => {
                                  setResetPwUser(u);
                                  setResetPwOpen(true);
                                }}>
                                  <KeyRound className="h-4 w-4 mr-2" /> Reset Password
                                </DropdownMenuItem>
                              )}

                              {u.role !== "owner" && u.role !== "super_admin" && (
                                <DropdownMenuItem onClick={() => {
                                  setAccessUser(u);
                                  setAccessOpen(true);
                                  fetchUserAccess(u.id, u.role || "");
                                }}>
                                  <ShieldCheck className="h-4 w-4 mr-2 text-blue-600" /> Hak Akses
                                </DropdownMenuItem>
                              )}

                              {(role === "owner" || role === "super_admin") && u.id !== user?.id && (
                                <DropdownMenuItem onClick={() => {
                                  setCommUser(u);
                                  setCommType((u.ccommission_type as any) || "per_certificate");
                                  setCommSalary(u.monthly_salary || 0);
                                  setCommTransport(u.transport_allowance || 0);
                                  setCommTarget(u.target_ktp || 130);
                                  setCommOverRate(u.over_target_rate || 25000);
                                  setCommOpen(true);
                                }}>
                                  <Calculator className="h-4 w-4 mr-2 text-blue-600" /> Komisi & Gaji
                                </DropdownMenuItem>
                              )}

                              {canDelete(u) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => {
                                      const confirmDelete = window.confirm(`Hapus user ${u.full_name}?`);
                                      if (confirmDelete) handleDelete(u.id);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" /> Hapus User
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              Menampilkan {users.length} dari {totalCount} user
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={page === 1 || loading}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                  let pageNum = i + 1;
                  if (totalPages > 5 && page > 3) {
                    pageNum = page - 3 + i;
                  }
                  if (pageNum > totalPages) return null;
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? "default" : "ghost"}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={page === totalPages || totalCount === 0 || loading}
                onClick={() => setPage(p => p + 1)}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
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
              {editingRole ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
              {editingOwner ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
              {resettingPw ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {resettingPw ? "Mereset..." : "Reset Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ccommission Settings Dialog */}
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
              <div className="space-y-4 border p-4 rounded-lg bg-muted/30">
                <div className="space-y-2">
                  <Label>Gaji Pokok (Bulanan)</Label>
                  <Input type="number" value={commSalary} onChange={(e) => setCommSalary(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Tunjangan Transport (Harian)</Label>
                  <Input type="number" value={commTransport} onChange={(e) => setCommTransport(Number(e.target.value))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Target KTP</Label>
                    <Input type="number" value={commTarget} onChange={(e) => setCommTarget(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Bonus Over Target</Label>
                    <Input type="number" value={commOverRate} onChange={(e) => setCommOverRate(Number(e.target.value))} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground border rounded-lg border-dashed">
                Skema komisi per sertifikat menggunakan nilai default sistem.
              </div>
            )}

            <Button className="w-full" onClick={handleSaveCcommission} disabled={savingComm}>
              {savingComm ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {savingComm ? "Menyimpan..." : "Simpan Pengaturan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Access Settings Dialog */}
      <Dialog open={accessOpen} onOpenChange={setAccessOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Hak Akses Field Form</DialogTitle>
            <DialogDescription>Atur field mana saja yang bisa dilihat atau diubah oleh {accessUser?.full_name}.</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4">
            {loadingAccess ? (
              <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Field</TableHead>
                    <TableHead className="text-center">Lihat</TableHead>
                    <TableHead className="text-center">Edit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { key: "nama", label: "Nama" },
                    { key: "alamat", label: "Alamat" },
                    { key: "nomor_hp", label: "Nomor HP" },
                    { key: "email_halal", label: "Email Halal" },
                    { key: "sandi_halal", label: "Sandi Halal" },
                    { key: "email_nib", label: "Email NIB" },
                    { key: "sandi_nib", label: "Sandi NIB" },
                    { key: "ktp", label: "Foto KTP" },
                    { key: "nib", label: "NIB" },
                    { key: "foto_produk", label: "Foto Produk" },
                    { key: "foto_verifikasi", label: "Foto Verifikasi" },
                    { key: "sertifikat", label: "Sertifikat Halal" },
                  ].map((field) => {
                    const access = userAccess[field.key] || { can_view: true, can_edit: true };
                    return (
                      <TableRow key={field.key}>
                        <TableCell className="font-medium">{field.label}</TableCell>
                        <TableCell className="text-center">
                          <Checkbox checked={access.can_view} onCheckedChange={() => handleToggleAccess(field.key, "can_view")} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox checked={access.can_edit} onCheckedChange={() => handleToggleAccess(field.key, "can_edit")} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="pt-4 border-t">
            <Button className="w-full" onClick={handleSaveAccess} disabled={savingAccess}>
              {savingAccess ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {savingAccess ? "Menyimpan..." : "Simpan Hak Akses"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
