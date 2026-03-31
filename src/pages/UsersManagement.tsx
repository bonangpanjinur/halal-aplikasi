import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AppRole } from "@/integrations/supabase/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, UserPlus, Shield, UserCog, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UserWithRole {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole | null;
  owner_id: string | null;
}

const UsersManagement = () => {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [owners, setOwners] = useState<UserWithRole[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  // State for Edit Role Dialog
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [newRole, setNewRole] = useState<AppRole | "">("");
  const [newOwnerId, setNewOwnerId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const canSelectOwner = role === "super_admin" && newRole !== "owner";

  const fetchUsers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch owners if needed
      if (owners.length === 0) {
        const { data: rolesData, error: rolesError } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "owner");
        
        if (rolesError) throw rolesError;

        if (rolesData && rolesData.length > 0) {
          const ownerIds = rolesData.map(r => r.user_id);
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", ownerIds);
          
          if (profilesError) throw profilesError;

          const ownerList = (profilesData || []).map((p: any) => ({
            id: p.id,
            full_name: p.full_name,
            email: p.email,
            role: "owner" as AppRole,
            owner_id: null
          }));
          setOwners(ownerList);
        }
      }

      // 2. Fetch profiles with pagination and filters
      let profileQuery = supabase
        .from("profiles")
        .select("*", { count: "exact" });

      if (role === "owner") {
        profileQuery = profileQuery.or(`id.eq.${user.id},owner_id.eq.${user.id}`);
      }

      if (filterOwner !== "all") {
        profileQuery = profileQuery.eq("owner_id", filterOwner);
      }

      if (searchQuery) {
        profileQuery = profileQuery.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      const { data: profiles, count, error: profilesError } = await profileQuery
        .order("full_name", { ascending: true })
        .range(from, to);

      if (profilesError) throw profilesError;

      if (profiles && profiles.length > 0) {
        // 3. Fetch roles for these profiles
        const userIds = profiles.map(p => p.id);
        const { data: rolesData, error: rolesError } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds);
        
        if (rolesError) throw rolesError;

        const roleMap = new Map(rolesData?.map(r => [r.user_id, r.role]));

        let merged: UserWithRole[] = profiles.map((p: any) => ({
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          role: roleMap.get(p.id) ?? null,
          owner_id: p.owner_id ?? null,
        }));

        // 4. Apply role filter client-side if needed (since we can't easily join)
        if (filterRole !== "all") {
          merged = merged.filter(u => u.role === filterRole);
        }

        setUsers(merged);
        setTotalCount(count || 0);
      } else {
        setUsers([]);
        setTotalCount(0);
      }
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Gagal mengambil data pengguna",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, role, page, filterRole, filterOwner, searchQuery, owners.length, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleUpdateRole = async () => {
    if (!editingUser || !newRole) return;

    try {
      // 1. Update role in user_roles
      const { error: roleError } = await supabase
        .from("user_roles")
        .update({ role: newRole as AppRole })
        .eq("user_id", editingUser.id);

      if (roleError) throw roleError;

      // 2. Update owner_id in profiles if applicable
      if (newRole !== "owner") {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ owner_id: newOwnerId })
          .eq("id", editingUser.id);

        if (profileError) throw profileError;
      }

      toast({
        title: "Berhasil",
        description: "Role pengguna berhasil diperbarui",
      });
      setIsEditDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast({
        title: "Error",
        description: "Gagal memperbarui role pengguna",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const { error: roleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (roleError) throw roleError;

      toast({
        title: "Berhasil",
        description: "Pengguna berhasil dihapus",
      });
      fetchUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: "Gagal menghapus pengguna",
        variant: "destructive",
      });
    }
  };

  const getRoleBadge = (role: AppRole | null) => {
    switch (role) {
      case "super_admin":
        return <Badge variant="destructive">Super Admin</Badge>;
      case "admin":
        return <Badge variant="default">Admin</Badge>;
      case "owner":
        return <Badge variant="secondary">Owner</Badge>;
      case "lapangan":
        return <Badge variant="outline">Lapangan</Badge>;
      case "nib":
        return <Badge variant="outline">NIB</Badge>;
      case "admin_input":
        return <Badge variant="outline">Admin Input</Badge>;
      case "umkm":
        return <Badge variant="outline">UMKM</Badge>;
      default:
        return <Badge variant="secondary">No Role</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Manajemen Pengguna</h1>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama atau email..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="w-full md:w-48">
          <Label>Filter Role</Label>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger>
              <SelectValue placeholder="Semua Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Role</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="lapangan">Lapangan</SelectItem>
              <SelectItem value="nib">NIB</SelectItem>
              <SelectItem value="admin_input">Admin Input</SelectItem>
              <SelectItem value="umkm">UMKM</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {role === "super_admin" && (
          <div className="w-full md:w-48">
            <Label>Filter Owner</Label>
            <Select value={filterOwner} onValueChange={setFilterOwner}>
              <SelectTrigger>
                <SelectValue placeholder="Semua Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Owner</SelectItem>
                {owners.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.full_name || o.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  Tidak ada pengguna ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name || "-"}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{getRoleBadge(u.role)}</TableCell>
                  <TableCell>
                    {u.role === "owner" 
                      ? "Self" 
                      : owners.find(o => o.id === u.owner_id)?.full_name || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingUser(u);
                          setNewRole(u.role || "");
                          setNewOwnerId(u.owner_id);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <UserCog className="h-4 w-4" />
                      </Button>
                      
                      {role === "super_admin" && u.id !== user?.id && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus Pengguna?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tindakan ini tidak dapat dibatalkan. Ini akan menghapus role dan akses pengguna.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(u.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Hapus
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Menampilkan {users.length} dari {totalCount} pengguna
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            Sebelumnya
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p + 1)}
            disabled={page * pageSize >= totalCount || loading}
          >
            Selanjutnya
          </Button>
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role Pengguna</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input value={editingUser?.full_name || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="lapangan">Lapangan</SelectItem>
                  <SelectItem value="nib">NIB</SelectItem>
                  <SelectItem value="admin_input">Admin Input</SelectItem>
                  <SelectItem value="umkm">UMKM</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {canSelectOwner && (
              <div className="space-y-2">
                <Label>Pilih Owner</Label>
                <Select value={newOwnerId || "none"} onValueChange={(v) => setNewOwnerId(v === "none" ? null : v)}>
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
            )}

            <Button className="w-full" onClick={handleUpdateRole}>
              Simpan Perubahan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersManagement;
