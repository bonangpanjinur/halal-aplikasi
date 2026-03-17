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
import { Plus, Trash2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRole {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole | null;
  owner_id?: string | null;
}

// Define which roles can be created by each role
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

  // Get creatable roles for current user
  const creatableRoles = useMemo(() => {
    if (!role) return [];
    return CREATABLE_ROLES[role] || [];
  }, [role]);

  // Filter role options based on what current user can create
  const roleOptions = useMemo(() => {
    return creatableRoles.map((r) => ({ value: r, label: ROLE_LABELS[r] }));
  }, [creatableRoles]);

  // Only super_admin can select owner for non-owner roles
  const canSelectOwner = role === "super_admin" && newRole !== "owner";

  // Check if user can access this page
  const canAccessPage = role === "super_admin" || role === "owner";

  const fetchUsers = async () => {
    if (!user) return;

    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");

    const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]));
    const merged: UserWithRole[] = (profiles ?? []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      role: roleMap.get(p.id) ?? null,
      owner_id: p.owner_id ?? null,
    }));

    // Filter users based on current user's role and scope
    let visibleUsers: UserWithRole[] = [];
    if (role === "super_admin") {
      // Super admin sees all users
      visibleUsers = merged;
    } else if (role === "owner") {
      // Owner sees only their own users and themselves
      visibleUsers = merged.filter((item) => item.id === user.id || item.owner_id === user.id);
    } else {
      // Other roles shouldn't access this page
      visibleUsers = [];
    }

    setUsers(visibleUsers.sort((a, b) => (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "")));
    setOwners(merged.filter((item) => item.role === "owner"));
  };

  useEffect(() => {
    fetchUsers();
  }, [role, user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate role can be created by current user
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

    // Determine owner_id based on role and current user
    let ownerId: string | undefined;
    if (role === "owner") {
      // Owner can only create users under themselves
      ownerId = user.id;
    } else if (role === "super_admin") {
      // Super admin can assign to specific owner or leave empty for owner role
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

    toast({ title: "User berhasil dibuat" });
    setOpen(false);
    setNewEmail("");
    setNewName("");
    setNewPassword("");
    setNewRole(creatableRoles[0] || "admin");
    setSelectedOwnerId("");
    await new Promise((resolve) => setTimeout(resolve, 800));
    fetchUsers();
  };

  const handleDelete = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke("delete-user", { body: { user_id: userId } });
    if (error || data?.error) {
      toast({ title: "Gagal menghapus user", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "User dihapus" });
    fetchUsers();
  };

  const roleBadgeVariant = (value: AppRole | null) => {
    switch (value) {
      case "super_admin": return "default";
      case "owner": return "default";
      case "admin": return "secondary";
      case "admin_input": return "secondary";
      default: return "outline";
    }
  };

  const canDeleteUser = (target: UserWithRole) => {
    if (!user || target.id === user.id || target.role === "super_admin") return false;
    if (role === "super_admin") {
      // Super admin can delete anyone except super_admin and themselves
      return true;
    }
    if (role === "owner") {
      // Owner can only delete users under them (not other owners)
      return target.role !== "owner" && target.owner_id === user.id;
    }
    return false;
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
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const ownerName = owners.find((ownerItem) => ownerItem.id === u.owner_id)?.full_name || owners.find((ownerItem) => ownerItem.id === u.owner_id)?.email || "-";
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || "-"}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell><Badge variant={roleBadgeVariant(u.role)}>{u.role?.replace("_", " ") ?? "No role"}</Badge></TableCell>
                    {role === "super_admin" && <TableCell>{u.role === "owner" ? "Tenant owner" : ownerName}</TableCell>}
                    <TableCell>
                      {canDeleteUser(u) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
    </div>
  );
}
