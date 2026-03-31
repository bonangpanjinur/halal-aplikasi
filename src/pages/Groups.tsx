import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, FolderOpen, Trash2, Building2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

    const { error } = await supabase.from("groups").insert({ name: newName, created_by: user.id, owner_id: role === "owner" ? user.id : undefined });
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

  const groupedGroups = groups.reduce((acc, group) => {
    const ownerName = group.profiles?.full_name || group.profiles?.email || "Tanpa Owner";
    if (!acc[ownerName]) acc[ownerName] = [];
    acc[ownerName].push(group);
    return acc;
  }, {} as Record<string, Group[]>);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Group Halal</h1>
          <p className="text-sm text-muted-foreground">Kelola grup data entry untuk sertifikasi halal.</p>
        </div>
        {(role === "super_admin" || role === "owner") && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Buat Group</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Buat Group Baru</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nama Group</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="Contoh: Halal Bandung 2026" />
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? "Membuat..." : "Buat Group"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Belum ada group
          </CardContent>
        </Card>
      ) : role === "super_admin" ? (
        <div className="space-y-10">
          {Object.entries(groupedGroups).map(([ownerName, ownerGroups]) => (
            <div key={ownerName} className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <Building2 className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">{ownerName}</h2>
                <Badge variant="secondary" className="ml-2">{ownerGroups.length} Grup</Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ownerGroups.map((g) => (
                  <Card key={g.id} className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-primary" onClick={() => navigate(`/groups/${g.id}`)}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-primary" />
                        {g.name}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(g); }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col gap-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" /> {ownerName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Dibuat: {new Date(g.created_at).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <Card key={g.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/groups/${g.id}`)}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  {g.name}
                </CardTitle>
                {(role === "super_admin" || role === "owner") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(g); }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Dibuat: {new Date(g.created_at).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Group "{deleteTarget?.name}"?</DialogTitle>
            <DialogDescription>
              Semua <strong>link share</strong> yang terkait group ini akan otomatis <strong>dinonaktifkan</strong> dan tidak bisa diakses lagi oleh publik. Data entry yang sudah masuk tetap tersimpan. Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete}>Hapus Group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
