import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { 
  Plus, 
  FolderOpen, 
  Trash2, 
  Building2, 
  User, 
  Search, 
  LayoutGrid, 
  List, 
  ChevronRight, 
  Calendar,
  MoreVertical,
  ArrowUpRight,
  Users,
  ChevronLeft,
  Filter,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface Group {
  id: string;
  name: string;
  created_at: string;
  owner_id: string | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export default function Groups() {
  const { role, user } = useAuth();
  const navigate = useNavigate();
  
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [owners, setOwners] = useState<{id: string, name: string}[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Create group state
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  
  const fetchGroups = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch owners for filter if super_admin
      if (role === "super_admin" && owners.length === 0) {
        const { data: ownerData } = await supabase
          .from("user_roles")
          .select("user_id, profiles:user_id(id, full_name, email)")
          .eq("role", "owner");
        
        const ownerList = (ownerData || []).map((od: any) => ({
          id: od.profiles?.id,
          name: od.profiles?.full_name || od.profiles?.email
        })).filter(o => o.id);
        setOwners(ownerList);
      }

      let query = supabase
        .from("groups")
        .select("*, profiles:owner_id(full_name, email)", { count: "exact" });

      if (role === "owner") {
        query = query.eq("owner_id", user.id);
      } else if (role === "super_admin" && filterOwner !== "all") {
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
      setGroups((data as any) ?? []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error("Error fetching groups:", error);
      toast({ title: "Gagal memuat grup", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, role, page, pageSize, searchQuery, filterOwner]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchGroups();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchGroups]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreating(true);

    const { error } = await supabase.from("groups").insert({ 
      name: newName, 
      created_by: user.id, 
      owner_id: role === "owner" ? user.id : undefined 
    });
    setCreating(false);

    if (error) {
      toast({ title: "Gagal membuat group", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Grup Berhasil Dibuat", description: `Grup "${newName}" telah siap digunakan.`, variant: "success" as any });
      setOpen(false);
      setNewName("");
      setPage(1);
      fetchGroups();
    }
  };

  const handleDelete = async (ids: string | string[]) => {
    const idsToDelete = Array.isArray(ids) ? ids : [ids];
    const { error } = await supabase.from("groups").delete().in("id", idsToDelete);
    if (error) {
      toast({ title: "Gagal menghapus", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Grup Dihapus", description: `${idsToDelete.length} grup telah berhasil dihapus.`, variant: "success" as any });
      setSelectedIds([]);
      fetchGroups();
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === groups.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(groups.map(g => g.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const stats = useMemo(() => {
    // Note: These stats are only for the current view, ideally should be fetched separately for total
    return {
      totalGroups: totalCount,
      totalOwners: role === "super_admin" ? owners.length : 1,
    };
  }, [totalCount, owners, role]);

  return (
    <div className="space-y-6 pb-10">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Group Halal</h1>
          <p className="text-muted-foreground">Kelola dan pantau grup data entry sertifikasi halal Anda.</p>
        </div>
        <div className="flex items-center gap-2">
          {(role === "super_admin" || role === "owner") && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="shadow-sm">
                  <Plus className="mr-2 h-4 w-4" /> Buat Group Baru
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Buat Group Baru</DialogTitle>
                  <DialogDescription>
                    Grup digunakan untuk mengelompokkan data entry dan membagikan link pendaftaran.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="group-name">Nama Group</Label>
                    <Input 
                      id="group-name"
                      value={newName} 
                      onChange={(e) => setNewName(e.target.value)} 
                      required 
                      placeholder="Contoh: Halal Bandung Barat 2026" 
                      className="focus-visible:ring-primary"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={creating}>
                    {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {creating ? "Memproses..." : "Konfirmasi & Buat"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      {groups.length > 0 && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-primary/5 border-primary/10 shadow-none">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FolderOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Grup</p>
                <p className="text-2xl font-bold">{stats.totalGroups}</p>
              </div>
            </CardContent>
          </Card>
          {role === "super_admin" && (
            <Card className="bg-blue-500/5 border-blue-500/10 shadow-none">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Owner</p>
                  <p className="text-2xl font-bold">{stats.totalOwners}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Toolbar Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex flex-1 flex-col sm:flex-row gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Cari nama grup..." 
              className="pl-9 bg-background"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
          {role === "super_admin" && (
            <Select value={filterOwner} onValueChange={(v) => { setFilterOwner(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[200px] bg-background">
                <Filter className="mr-2 h-3 w-3" />
                <SelectValue placeholder="Semua Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Owner</SelectItem>
                {owners.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
            <SelectTrigger className="w-[100px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12">12 / hal</SelectItem>
              <SelectItem value="24">24 / hal</SelectItem>
              <SelectItem value="48">48 / hal</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center border rounded-lg p-1 bg-background">
            <Button 
              variant={viewMode === "grid" ? "secondary" : "ghost"} 
              size="sm" 
              className="h-8 w-8 p-0"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === "list" ? "secondary" : "ghost"} 
              size="sm" 
              className="h-8 w-8 p-0"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="p-3 px-4 bg-primary/5 border rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <Checkbox 
              checked={selectedIds.length === groups.length}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              {selectedIds.length} grup terpilih
            </span>
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
                  <AlertDialogTitle>Hapus {selectedIds.length} Grup?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tindakan ini tidak dapat dibatalkan. Semua data terkait grup yang dipilih akan terpengaruh.
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

      {/* Content Section */}
      {loading ? (
        <div className={cn(
          "grid gap-6",
          viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1"
        )}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-40 bg-muted animate-pulse rounded-xl border" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-20 flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
              <FolderOpen className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Tidak ada grup ditemukan</h3>
            <p className="text-muted-foreground max-w-xs mx-auto">
              {searchQuery ? `Tidak ada hasil untuk "${searchQuery}". Coba kata kunci lain.` : "Mulai dengan membuat grup pertama Anda."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {viewMode === "grid" ? (
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {groups.map((group) => (
                <Card 
                  key={group.id} 
                  className={cn(
                    "group relative overflow-hidden transition-all hover:shadow-md border-muted/60",
                    selectedIds.includes(group.id) && "border-primary bg-primary/5 ring-1 ring-primary"
                  )}
                >
                  <div className="absolute top-3 left-3 z-10">
                    <Checkbox 
                      checked={selectedIds.includes(group.id)}
                      onCheckedChange={() => toggleSelect(group.id)}
                    />
                  </div>
                  <CardHeader className="pb-2 pt-10">
                    <div className="flex justify-between items-start">
                      <div className="p-2 bg-primary/10 rounded-lg mb-2">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/groups/${group.id}`)}>
                            <ArrowUpRight className="mr-2 h-4 w-4" /> Buka Detail
                          </DropdownMenuItem>
                          {(role === "super_admin" || (role === "owner" && group.owner_id === user?.id)) && (
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                if (window.confirm(`Hapus grup "${group.name}"?`)) {
                                  handleDelete(group.id);
                                }
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Hapus Grup
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardTitle className="text-xl line-clamp-1">{group.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(group.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {role === "super_admin" && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          <span className="truncate">{group.profiles?.full_name || group.profiles?.email || "Tanpa Owner"}</span>
                        </div>
                      )}
                      <Button 
                        variant="secondary" 
                        className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                        onClick={() => navigate(`/groups/${group.id}`)}
                      >
                        Kelola Grup
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="p-4 text-left w-10">
                        <Checkbox 
                          checked={selectedIds.length === groups.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </th>
                      <th className="p-4 text-left font-medium">Nama Grup</th>
                     {role === "super_admin" && <th className="p-4 text-left font-medium">Owner</th>}
                      <th className="p-4 text-left font-medium">Dibuat Pada</th>
                      <th className="p-4 text-right font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {groups.map((group) => (
                      <tr key={group.id} className={cn(
                        "hover:bg-muted/30 transition-colors",
                        selectedIds.includes(group.id) && "bg-primary/5"
                      )}>
                        <td className="p-4">
                          <Checkbox 
                            checked={selectedIds.includes(group.id)}
                            onCheckedChange={() => toggleSelect(group.id)}
                          />
                        </td>
                        <td className="p-4 font-medium">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <Users className="h-4 w-4 text-primary" />
                            </div>
                            {group.name}
                          </div>
                        </td>
                        {role === "super_admin" && (
                          <td className="p-4 text-muted-foreground">
                            {group.profiles?.full_name || group.profiles?.email || "-"}
                          </td>
                        )}
                        <td className="p-4 text-muted-foreground">
                          {new Date(group.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/groups/${group.id}`)}>
                              Detail
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {(role === "super_admin" || (role === "owner" && group.owner_id === user?.id)) && (
                                  <DropdownMenuItem 
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => handleDelete(group.id)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Hapus
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
            <div className="text-sm text-muted-foreground">
              Menampilkan {groups.length} dari {totalCount} grup
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
        </>
      )}
    </div>
  );
}
