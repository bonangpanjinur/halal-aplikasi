import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Copy, QrCode, Trash2 } from "lucide-react";

interface LinkRow {
  id: string;
  group_id: string;
  token: string;
  slug: string | null;
  is_active: boolean;
  created_at: string;
  user_id: string;
  group_name?: string;
  entry_count?: number;
  pic_name?: string;
}

interface GroupOption {
  id: string;
  name: string;
}

interface PicOption {
  id: string;
  full_name: string | null;
  email: string | null;
}

export default function ShareLinks() {
  const { user, role } = useAuth();
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [picUsers, setPicUsers] = useState<PicOption[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedPic, setSelectedPic] = useState("");
  const [creating, setCreating] = useState(false);

  const canSelectPic = role === "super_admin" || role === "owner" || role === "admin";

  const fetchPicUsers = async () => {
    if (!user) return;
    let query = supabase.from("profiles").select("id, full_name, email");
    if (role === "owner") {
      query = query.eq("owner_id", user.id);
    }
    const { data } = await query;
    setPicUsers(data ?? []);
  };

  const fetchLinks = async () => {
    if (!user) return;
    const { data } = await supabase.from("shared_links").select("*");
    if (data) {
      const groupIds = [...new Set(data.map((l: any) => l.group_id))];
      const linkIds = data.map((l: any) => l.id);
      const picIds = [...new Set(data.map((l: any) => l.user_id))];
      const [{ data: groupData }, { data: entryCountData }, { data: picData }] = await Promise.all([
        supabase.from("groups").select("id, name").in("id", groupIds.length > 0 ? groupIds : ["__none__"]),
        supabase.from("data_entries").select("source_link_id").in("source_link_id", linkIds.length > 0 ? linkIds : ["__none__"]),
        supabase.from("profiles").select("id, full_name, email").in("id", picIds.length > 0 ? picIds : ["__none__"]),
      ]);
      const gMap = new Map(groupData?.map((g: any) => [g.id, g.name]));
      const picMap = new Map(picData?.map((p: any) => [p.id, p.full_name || p.email || "-"]));
      const countMap = new Map<string, number>();
      (entryCountData ?? []).forEach((e: any) => {
        countMap.set(e.source_link_id, (countMap.get(e.source_link_id) || 0) + 1);
      });
      setLinks(data.map((l: any) => ({
        ...l,
        group_name: gMap.get(l.group_id),
        entry_count: countMap.get(l.id) || 0,
        pic_name: picMap.get(l.user_id) || "-",
      })));
    }
  };

  const fetchGroups = async () => {
    const { data } = await supabase.from("groups").select("id, name");
    setGroups(data ?? []);
  };

  useEffect(() => {
    fetchLinks();
    fetchGroups();
    if (canSelectPic) fetchPicUsers();
  }, [user]);

  const handleCreate = async () => {
    if (!user || !selectedGroup) return;
    setCreating(true);
    const picUserId = canSelectPic && selectedPic ? selectedPic : user.id;
    const { error } = await supabase.from("shared_links").insert({
      user_id: picUserId,
      group_id: selectedGroup,
    } as any);
    setCreating(false);
    if (error) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Link dibuat" });
      setSelectedGroup("");
      setSelectedPic("");
      fetchLinks();
    }
  };

  const toggleActive = async (link: LinkRow) => {
    await supabase.from("shared_links").update({ is_active: !link.is_active }).eq("id", link.id);
    fetchLinks();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("shared_links").delete().eq("id", id);
    fetchLinks();
  };

  const getShareUrl = (link: LinkRow) => {
    if (link.slug) {
      return `${window.location.origin}/f/${link.slug}`;
    }
    return `${window.location.origin}/public-form/${link.token}`;
  };

  const copyLink = (link: LinkRow) => {
    navigator.clipboard.writeText(getShareUrl(link));
    toast({ title: "Link disalin!" });
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Share Link</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Buat Link Baru</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Pilih group..." /></SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canSelectPic && (
              <Select value={selectedPic} onValueChange={setSelectedPic}>
                <SelectTrigger><SelectValue placeholder="Pilih PIC (opsional)..." /></SelectTrigger>
                <SelectContent>
                  {picUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name || u.email || u.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={handleCreate} disabled={!selectedGroup || creating} className="w-fit">
              <Plus className="mr-2 h-4 w-4" /> Buat
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group</TableHead>
                <TableHead>PIC</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Data Masuk</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dibuat</TableHead>
                <TableHead className="w-32">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.group_name}</TableCell>
                  <TableCell className="text-sm">{l.pic_name}</TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono">
                      /f/{l.slug || "..."}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{l.entry_count ?? 0}</Badge>
                  </TableCell>
                   <TableCell>
                    <Badge
                      variant={l.is_active ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => toggleActive(l)}
                    >
                      {l.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(l.created_at).toLocaleDateString("id-ID")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => copyLink(l)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(getShareUrl(l))}`, "_blank")}>
                        <QrCode className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(l.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {links.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Belum ada link
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
