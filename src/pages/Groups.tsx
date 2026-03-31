import { useEffect, useState, useMemo } from "react";
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
  Users
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

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
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const fetchGroups = async () => {
    const { data } = await supabase
      .from("groups")
      .select("*, profiles:owner_id(full_name, email)")
      .order("created_at", { ascending: false });
    setGroups((data as any) ?? []);
  };

  useEffect(() => {
    fetchGroups();
  }, []);

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
      fetchGroups();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("groups").delete().eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "Gagal menghapus", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Grup Dihapus", description: "Data grup telah berhasil dihapus dari sistem.", variant: "success" as any });
      fetchGroups();
    }
    setDeleteTarget(null);
  };

  const filteredGroups = useMemo(() => {
    return groups.filter(g => 
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.profiles?.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.profiles?.email || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [groups, searchQuery]);

  const groupedGroups = useMemo(() => {
    return filteredGroups.reduce((acc, group) => {
      const ownerName = group.profiles?.full_name || group.profiles?.email || "Tanpa Owner";
      if (!acc[ownerName]) acc[ownerName] = [];
      acc[ownerName].push(group);
      return acc;
    }, {} as Record<string, Group[]>);
  }, [filteredGroups]);

  const stats = useMemo(() => {
    return {
      totalGroups: groups.length,
      totalOwners: new Set(groups.map(g => g.owner_id).filter(Boolean)).size,
      recentGroups: groups.filter(g => {
        const date = new Date(g.created_at);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      }).length
    };
  }, [groups]);

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
                    {creating ? "Memproses..." : "Konfirmasi & Buat"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Stats Overview (Only for Super Admin) */}
      {role === "super_admin" && groups.length > 0 && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card className="bg-primary/5 border-primary/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FolderOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Grup</p>
                <p className="text-2xl font-bold">{stats.totalGroups}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/5 border-blue-500/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Owner</p>
                <p className="text-2xl font-bold">{stats.totalOwners}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-500/5 border-green-500/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Calendar className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Grup Baru (7 Hari)</p>
                <p className="text-2xl font-bold">{stats.recentGroups}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Toolbar Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Cari nama grup atau owner..." 
            className="pl-9 bg-background"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
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

      {/* Content Section */}
      {filteredGroups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-20 flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
              <FolderOpen className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Tidak ada grup ditemukan</h3>
            <p className="text-muted-foreground max-w-xs mx-auto">
              {searchQuery ? `Tidak ada hasil untuk "${searchQuery}". Coba kata kunci lain.` : "Mulai dengan membuat grup pertama Anda untuk mengelola data entry."}
            </p>
            {!searchQuery && (role === "super_admin" || role === "owner") && (
              <Button variant="outline" className="mt-6" onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Buat Grup Sekarang
              </Button>
            )}
          </CardContent>
        </Card>
      ) : role === "super_admin" ? (
        <div className="space-y-12">
          {Object.entries(groupedGroups).map(([ownerName, ownerGroups]) => (
            <div key={ownerName} className="space-y-5">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      {ownerName}
                    </h2>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" /> {ownerGroups.length} Grup Terdaftar
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/5">
                  Lihat Detail Owner <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>

              {viewMode === "grid" ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {ownerGroups.map((g) => (
                    <GroupCard 
                      key={g.id} 
                      group={g} 
                      onNavigate={() => navigate(`/groups/${g.id}`)}
                      onDelete={() => setDeleteTarget(g)}
                      showOwner={false}
                    />
                  ))}
                </div>
              ) : (
                <div className="border rounded-xl overflow-hidden bg-card">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left p-4 font-medium">Nama Grup</th>
                        <th className="text-left p-4 font-medium">Tanggal Dibuat</th>
                        <th className="text-right p-4 font-medium">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {ownerGroups.map((g) => (
                        <GroupRow 
                          key={g.id} 
                          group={g} 
                          onNavigate={() => navigate(`/groups/${g.id}`)}
                          onDelete={() => setDeleteTarget(g)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className={cn(
          viewMode === "grid" 
            ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-3" 
            : "border rounded-xl overflow-hidden bg-card"
        )}>
          {viewMode === "grid" ? (
            filteredGroups.map((g) => (
              <GroupCard 
                key={g.id} 
                group={g} 
                onNavigate={() => navigate(`/groups/${g.id}`)}
                onDelete={() => setDeleteTarget(g)}
                showOwner={false}
              />
            ))
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-4 font-medium">Nama Grup</th>
                  <th className="text-left p-4 font-medium">Tanggal Dibuat</th>
                  <th className="text-right p-4 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredGroups.map((g) => (
                  <GroupRow 
                    key={g.id} 
                    group={g} 
                    onNavigate={() => navigate(`/groups/${g.id}`)}
                    onDelete={() => setDeleteTarget(g)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Hapus Grup
            </DialogTitle>
            <DialogDescription className="pt-2">
              Apakah Anda yakin ingin menghapus grup <strong>"{deleteTarget?.name}"</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-destructive/5 p-4 rounded-lg border border-destructive/10 text-sm text-destructive-foreground/80 space-y-2">
            <p>• Semua <strong>link share</strong> terkait akan dinonaktifkan.</p>
            <p>• Data entry yang sudah masuk <strong>tetap tersimpan</strong>.</p>
            <p>• Tindakan ini <strong>tidak dapat dibatalkan</strong>.</p>
          </div>
          <DialogFooter className="flex sm:justify-between gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">Batal</Button>
            <Button variant="destructive" onClick={handleDelete} className="flex-1">Ya, Hapus Grup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GroupCard({ group, onNavigate, onDelete, showOwner }: { 
  group: Group, 
  onNavigate: () => void, 
  onDelete: () => void,
  showOwner?: boolean
}) {
  return (
    <Card 
      className="group cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200 overflow-hidden relative"
      onClick={onNavigate}
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
      <CardHeader className="p-5 pb-3">
        <div className="flex items-start justify-between">
          <div className="p-2 bg-primary/5 rounded-lg group-hover:bg-primary/10 transition-colors">
            <FolderOpen className="h-5 w-5 text-primary" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onNavigate}>
                <ArrowUpRight className="mr-2 h-4 w-4" /> Buka Grup
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" /> Hapus Grup
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CardTitle className="text-lg mt-3 line-clamp-1">{group.name}</CardTitle>
        {showOwner && (
          <CardDescription className="flex items-center gap-1 mt-1">
            <User className="h-3 w-3" /> {group.profiles?.full_name || group.profiles?.email || "Tanpa Owner"}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <div className="flex items-center justify-between mt-4 pt-4 border-t text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(group.created_at).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          <Badge variant="outline" className="text-[10px] font-normal py-0 h-5">Aktif</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function GroupRow({ group, onNavigate, onDelete }: { 
  group: Group, 
  onNavigate: () => void, 
  onDelete: () => void 
}) {
  return (
    <tr 
      className="group hover:bg-muted/30 cursor-pointer transition-colors"
      onClick={onNavigate}
    >
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/5 rounded-lg">
            <FolderOpen className="h-4 w-4 text-primary" />
          </div>
          <span className="font-medium">{group.name}</span>
        </div>
      </td>
      <td className="p-4 text-muted-foreground">
        {new Date(group.created_at).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}
      </td>
      <td className="p-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onNavigate}>Buka</Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
