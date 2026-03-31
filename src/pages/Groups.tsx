import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Search, Users, Trash2, Edit2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface Group {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
}

interface OwnerOption {
  id: string;
  name: string;
}

const Groups = () => {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [owners, setOwners] = useState<OwnerOption[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  // Create Group Dialog State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupOwner, setNewGroupOwner] = useState("");

  const fetchGroups = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch owners for filter if super_admin
      if (role === "super_admin" && owners.length === 0) {
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
            name: p.full_name || p.email || "Unknown"
          }));
          setOwners(ownerList);
        }
      }

      // 2. Fetch groups
      let query = supabase
        .from("groups")
        .select("*, profiles:owner_id(full_name, email)", { count: "exact" });

      if (role === "owner") {
        query = query.eq("owner_id", user.id);
      } else if (filterOwner !== "all") {
        query = query.eq("owner_id", filterOwner);
      }

      if (searchQuery) {
        query = query.ilike("name", `%${searchQuery}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      setGroups(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      console.error("Error fetching groups:", error);
      toast({
        title: "Error",
        description: "Gagal mengambil data grup",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, role, page, filterOwner, searchQuery, owners.length, toast]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleCreateGroup = async () => {
    if (!newGroupName) return;
    
    const ownerId = role === "super_admin" ? newGroupOwner : user?.id;
    if (!ownerId) {
      toast({
        title: "Error",
        description: "Owner harus dipilih",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("groups")
        .insert({
          name: newGroupName,
          owner_id: ownerId
        });

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Grup berhasil dibuat",
      });
      setIsCreateDialogOpen(false);
      setNewGroupName("");
      setNewGroupOwner("");
      fetchGroups();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteGroup = async (id: string) => {
    try {
      const { error } = await supabase
        .from("groups")
        .delete()
        .eq("id", id);

      if (error) throw error;
      fetchGroups();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Gagal menghapus grup. Pastikan grup sudah kosong.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Manajemen Grup</h1>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama grup..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Grup Baru
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Buat Grup Baru</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nama Grup</Label>
                  <Input 
                    value={newGroupName} 
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Contoh: Batch Januari 2024"
                  />
                </div>
                {role === "super_admin" && (
                  <div className="space-y-2">
                    <Label>Pilih Owner</Label>
                    <Select value={newGroupOwner} onValueChange={setNewGroupOwner}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih Owner" />
                      </SelectTrigger>
                      <SelectContent>
                        {owners.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button className="w-full" onClick={handleCreateGroup}>Buat Grup</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
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
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : groups.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            Tidak ada grup ditemukan.
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.id} className="bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-primary/10 p-3 rounded-lg">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteGroup(group.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <h3 className="text-lg font-bold mb-1 truncate">{group.name}</h3>
                <div className="flex items-center text-sm text-muted-foreground mb-4">
                  <span className="truncate">{group.profiles?.full_name || group.profiles?.email || "Tanpa Owner"}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Dibuat pada {new Date(group.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
              <div className="border-t p-4 bg-muted/30">
                <Button asChild className="w-full" variant="secondary">
                  <Link to={`/groups/${group.id}`}>
                    Lihat Detail
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Menampilkan {groups.length} dari {totalCount} grup
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
    </div>
  );
};

export default Groups;
