import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFieldAccess } from "@/hooks/useFieldAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Users, FileText, Trash2, Download, Loader2, CheckCircle2, Clock, ShieldCheck, Search, Filter, FileSpreadsheet, RefreshCw, History, ArrowRight, FileCheck, Send, Award, AlertTriangle, Link2 } from "lucide-react";
import DataEntryForm from "@/components/DataEntryForm";
import PhotoGallery from "@/components/PhotoGallery";
import type { Tables, Enums } from "@/integrations/supabase/types";

type DataEntry = Tables<"data_entries">;

interface AuditLog {
  id: string;
  entry_id: string;
  entry_name: string | null;
  group_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  changed_at: string;
  changer_name?: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  belum_lengkap: { label: "Belum Lengkap", variant: "destructive", icon: Clock },
  siap_input: { label: "Siap Input", variant: "secondary", icon: CheckCircle2 },
  lengkap: { label: "Lengkap", variant: "outline", icon: FileCheck },
  terverifikasi: { label: "Terverifikasi", variant: "default", icon: ShieldCheck },
  nib_selesai: { label: "NIB Selesai", variant: "default", icon: FileCheck },
  ktp_terdaftar_nib: { label: "KTP Terdaftar NIB", variant: "destructive", icon: AlertTriangle },
  ktp_terdaftar_sertifikat: { label: "KTP Terdaftar Sertifikat", variant: "destructive", icon: AlertTriangle },
  pengajuan: { label: "Pengajuan", variant: "outline", icon: Send },
  sertifikat_selesai: { label: "Sertifikat Selesai", variant: "default", icon: Award },
  revisi: { label: "Revisi", variant: "destructive", icon: RefreshCw },
  selesai_revisi: { label: "Selesai Revisi", variant: "secondary", icon: CheckCircle2 },
};

interface MemberWithProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
}

export default function GroupDetail() {
  const { id: groupId } = useParams<{ id: string }>();
  const { role, user, owner_id } = useAuth();
  const [group, setGroup] = useState<Tables<"groups"> | null>(null);
  const [entries, setEntries] = useState<DataEntry[]>([]);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [photoCounts, setPhotoCounts] = useState<Record<string, { produk: number; verifikasi: number }>>({});
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DataEntry | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<{ id: string; email: string | null; full_name: string | null }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  // Link UMKM dialog state
  const [linkUmkmOpen, setLinkUmkmOpen] = useState(false);
  const [linkUmkmEntryId, setLinkUmkmEntryId] = useState<string | null>(null);
  const [umkmUsers, setUmkmUsers] = useState<{ id: string; full_name: string | null; email: string | null }[]>([]);
  const [selectedUmkmUserId, setSelectedUmkmUserId] = useState("");
  const [linkingUmkm, setLinkingUmkm] = useState(false);

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Filter & search state
  const [searchQuery, setSearchQuery] = useState("");
  const isAdminInput = role === "admin_input";
  const [statusFilter, setStatusFilter] = useState<string>(isAdminInput ? "siap_input" : "all");

  // Download state
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  const canDownload = role === "super_admin" || role === "owner" || role === "admin" || role === "admin_input";

  // Use field access for granular per-status permissions
  const { canEdit: canEditField } = useFieldAccess();
  // Phase 3: Remove super role assumption, everyone follows granular permissions
  const allowedStatuses = Object.keys(STATUS_CONFIG).filter((s) => canEditField(`status:${s}`));
  const canChangeStatus = allowedStatuses.length > 0;

  const filteredEntries = entries.filter((e) => {
    const matchesSearch = searchQuery === "" ||
      (e.nama?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.alamat?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const fetchGroup = async () => {
    if (!groupId) return;
    const { data } = await supabase.from("groups").select("*").eq("id", groupId).single();
    setGroup(data);
  };

  const fetchEntries = async (page: number = 1) => {
    if (!groupId) return;
    
    // Calculate offset for pagination
    const offset = (page - 1) * ITEMS_PER_PAGE;
    
    // Parallelize total count and paginated data fetching
    const [countRes, dataRes] = await Promise.all([
      supabase
        .from("data_entries")
        .select("id", { count: "exact", head: true })
        .eq("group_id", groupId),
      supabase
        .from("data_entries")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .range(offset, offset + ITEMS_PER_PAGE - 1)
    ]);
    
    const totalCount = countRes.count ?? 0;
    const data = dataRes.data ?? [];
    
    setTotalEntries(totalCount);
    setEntries(data);
    
    // Fetch photo counts for the current page only
    if (data.length > 0) {
      const entryIds = data.map((e) => e.id);
      const { data: photos } = await supabase
        .from("entry_photos" as any)
        .select("entry_id, photo_type")
        .in("entry_id", entryIds);
        
      const counts: Record<string, { produk: number; verifikasi: number }> = {};
      (photos ?? []).forEach((p: any) => {
        if (!counts[p.entry_id]) counts[p.entry_id] = { produk: 0, verifikasi: 0 };
        if (p.photo_type === "produk") counts[p.entry_id].produk++;
        else if (p.photo_type === "verifikasi") counts[p.entry_id].verifikasi++;
      });
      setPhotoCounts(counts);
    }
  };

  const fetchMembers = async () => {
    if (!groupId) return;
    const { data: gm, error: gmError } = await supabase.from("group_members").select("*").eq("group_id", groupId);
    if (gmError || !gm) {
      setMembers([]);
      return;
    }

    if (gm.length === 0) {
      setMembers([]);
      return;
    }

    const userIds = gm.map((m) => m.user_id);
    const { data: profiles } = await supabase.from("profiles").select("*").in("id", userIds);
    const { data: roles } = await supabase.from("user_roles").select("*").in("user_id", userIds);

    const profileMap = new Map(profiles?.map((p) => [p.id, p]));
    const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]));

    setMembers(
      gm.map((m) => ({
        id: m.id,
        user_id: m.user_id,
        full_name: profileMap.get(m.user_id)?.full_name ?? null,
        email: profileMap.get(m.user_id)?.email ?? null,
        role: roleMap.get(m.user_id) ?? null,
      }))
    );
  };

  const fetchAuditLogs = async () => {
    if (!groupId) return;
    setAuditLoading(true);
    const { data: logs } = await supabase
      .from("audit_logs" as any)
      .select("*")
      .eq("group_id", groupId)
      .order("changed_at", { ascending: false })
      .limit(200);

    const typedLogs = (logs as unknown as AuditLog[]) ?? [];

    if (typedLogs.length > 0) {
      const changerIds = [...new Set(typedLogs.map((l) => l.changed_by).filter(Boolean))] as string[];
      const { data: profiles } = changerIds.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", changerIds)
        : { data: [] };
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email || "Unknown"]));

      setAuditLogs(
        typedLogs.map((l) => ({
          ...l,
          changer_name: l.changed_by ? (profileMap.get(l.changed_by) ?? "Unknown") : "Sistem",
        }))
      );
    } else {
      setAuditLogs([]);
    }
    setAuditLoading(false);
  };

  const fetchAvailableUsers = async () => {
    if (!groupId) return;
    
    // 1. Fetch existing members first to ensure we have the latest list
    const { data: existing, error: existingError } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId);
    
    if (existingError) return;
    const existingIds = new Set(existing?.map((e) => e.user_id));

    // 2. Fetch profiles
    let query = supabase.from("profiles").select("*");
    
    // If user is owner, only show users linked to this owner
    if (role === "owner" && owner_id) {
      query = query.or(`id.eq.${user?.id},owner_id.eq.${owner_id}`);
    }
    
    const { data: profiles, error: profilesError } = await query;
    if (profilesError || !profiles) return;
    
    // 3. Filter out users who are already in the group
    const filtered = profiles.filter((p) => !existingIds.has(p.id));
    
    // 4. Sort and update state
    setAvailableUsers(filtered.sort((a, b) => 
      (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "")
    ));
  };

  const filteredAvailableUsers = availableUsers.filter(u => 
    !memberSearchQuery || 
    u.full_name?.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(memberSearchQuery.toLowerCase())
  );
  const fetchUmkmUsers = async () => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "umkm" as any);
    if (!roles?.length) { setUmkmUsers([]); return; }
    const userIds = roles.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    setUmkmUsers(profiles ?? []);
  };

  const handleLinkUmkm = async () => {
    if (!linkUmkmEntryId) return;
    setLinkingUmkm(true);
    const { error } = await supabase
      .from("data_entries")
      .update({ umkm_user_id: selectedUmkmUserId || null } as any)
      .eq("id", linkUmkmEntryId);
    setLinkingUmkm(false);
    if (error) {
      toast({ title: "Gagal menghubungkan", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil dihubungkan", description: "Akun UMKM telah berhasil dikaitkan.", variant: "success" as any });
      setEntries((prev) => prev.map((e) => e.id === linkUmkmEntryId ? { ...e, umkm_user_id: selectedUmkmUserId || null } as any : e));
      setLinkUmkmOpen(false);
      setLinkUmkmEntryId(null);
      setSelectedUmkmUserId("");
    }
  };

  useEffect(() => {
    fetchGroup();
    fetchEntries(currentPage);
    fetchMembers();
    if (role === "super_admin" || role === "owner" || role === "admin") {
      fetchAuditLogs();
    }
  }, [groupId, role, currentPage]);

  // Role configuration: roles that can only have one member per group
  const SINGLE_ROLE_PER_GROUP = ["owner", "lapangan", "nib", "admin_input", "admin"];

  const handleAddMember = async () => {
    if (!selectedUserId) return;

    try {
      // Get the role of the user being added
      const { data: userRoleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", selectedUserId)
        .single();

      if (roleError) {
        toast({ 
          title: "Error", 
          description: "Gagal mengambil data role user.", 
          variant: "destructive" 
        });
        return;
      }

      const newUserRole = userRoleData?.role;

      // Check for duplicate role prevention
      if (newUserRole && SINGLE_ROLE_PER_GROUP.includes(newUserRole)) {
        const existingRoleMember = members.find(m => m.role === newUserRole);
        if (existingRoleMember) {
          toast({ 
            title: "Batas Peran Tercapai", 
            description: `Grup ini sudah memiliki 1 ${newUserRole.replace("_", " ")}. Setiap grup hanya boleh memiliki maksimal 1 orang per peran untuk menjaga ketertiban PIC.`, 
            variant: "warning" as any
          });
          return;
        }
      }

      // Add member to group
      const { error: insertError } = await supabase.from("group_members").insert({ group_id: groupId, user_id: selectedUserId });
      if (insertError) {
        toast({ title: "Gagal", description: insertError.message, variant: "destructive" });
      } else {
        toast({ title: "Anggota Ditambahkan", description: "User berhasil ditambahkan ke dalam grup.", variant: "success" as any });
        setAddMemberOpen(false);
        setSelectedUserId("");
        setMemberSearchQuery("");
        await fetchMembers();
        await fetchAvailableUsers();
      }
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Terjadi kesalahan saat menambahkan anggota.", 
        variant: "destructive" 
      });
    }
  };
  const handleRemoveMember = async (memberId: string) => {
    await supabase.from("group_members").delete().eq("id", memberId);
    fetchMembers();
  };

  const handleDeleteEntry = async (entryId: string) => {
    await supabase.from("data_entries").delete().eq("id", entryId);
    fetchEntries();
  };

  const handleStatusChange = async (entryId: string, status: string) => {
    const { error } = await supabase.from("data_entries").update({ status } as any).eq("id", entryId);
    if (error) {
      toast({ title: "Gagal mengubah status", description: error.message, variant: "destructive" });
    } else {
      setEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, status } as any : e));
    }
  };

  const handleEntrySaved = (_trackingCode?: string) => {
    setShowEntryForm(false);
    setEditingEntry(null);
    fetchEntries();
  };

  // Download handlers
  const toggleEntry = (id: string) => {
    setSelectedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedEntries.size === entries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(entries.map((e) => e.id)));
    }
  };

  const handleDownload = async (ids: string[]) => {
    setDownloading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-entries`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ entry_ids: ids }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Download gagal");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] || "data.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({ title: "Download Berhasil", description: "File sedang diunduh ke perangkat Anda.", variant: "success" as any });
      setSelectedEntries(new Set());
    } catch (err: any) {
      toast({ title: "Download gagal", description: err.message, variant: "destructive" });
    }
    setDownloading(false);
  };

  const handleExportCsv = () => {
    const dataToExport = selectedEntries.size > 0
      ? filteredEntries.filter((e) => selectedEntries.has(e.id))
      : filteredEntries;

    if (dataToExport.length === 0) {
      toast({ title: "Tidak ada data untuk di-export", variant: "destructive" });
      return;
    }

    const statusLabel = (s: string) => STATUS_CONFIG[s]?.label || s;
    const headers = ["Nama", "Status", "Email Halal", "Sandi Halal", "Email NIB", "Sandi NIB", "Alamat", "Nomor HP", "KTP", "NIB", "Foto Produk", "Foto Verifikasi", "Tanggal Dibuat"];
    const rows = dataToExport.map((e) => [
      e.nama || "",
      statusLabel(e.status),
      (e as any).email_halal || "",
      (e as any).sandi_halal || "",
      (e as any).email_nib || "",
      (e as any).sandi_nib || "",
      e.alamat || "",
      e.nomor_hp || "",
      e.ktp_url || "",
      e.nib_url || "",
      e.foto_produk_url || "",
      e.foto_verifikasi_url || "",
      new Date(e.created_at).toLocaleDateString("id-ID"),
    ]);

    const escapeCsv = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const csv = [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${group?.name || "data"}-export.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast({ title: `${dataToExport.length} data berhasil di-export ke CSV` });
  };

  // Bulk status update
  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedEntries.size === 0) return;
    const ids = [...selectedEntries];
    const { error } = await supabase
      .from("data_entries")
      .update({ status: newStatus } as any)
      .in("id", ids);
    if (error) {
      toast({ title: "Gagal mengubah status", description: error.message, variant: "destructive" });
    } else {
      setEntries((prev) =>
        prev.map((e) => (ids.includes(e.id) ? { ...e, status: newStatus } as any : e))
      );
      setSelectedEntries(new Set());
      toast({ title: `${ids.length} entri diubah ke ${STATUS_CONFIG[newStatus]?.label || newStatus}` });
    }
  };

  // Realtime subscription
  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`entries-${groupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "data_entries", filter: `group_id=eq.${groupId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newEntry = payload.new as DataEntry;
            // Non-super_admin only sees own entries
            if (role !== "super_admin" && role !== "owner" && role !== "admin" && user && (newEntry as any).created_by !== user.id) return;
            // Reset to first page when new entry is added
            setCurrentPage(1);
            setEntries((prev) => [newEntry, ...prev]);
            toast({ title: "Data baru masuk", description: newEntry.nama || "Entri baru ditambahkan" });
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as DataEntry;
            // Non-super_admin only updates own entries
            if (role !== "super_admin" && role !== "owner" && role !== "admin" && user && (updated as any).created_by !== user.id) return;
            setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
            // Refresh total count when status changes
            fetchEntries(currentPage);
            const oldStatus = (payload.old as any)?.status;
            if (oldStatus && oldStatus !== updated.status) {
              toast({
                title: "Status berubah",
                description: `${updated.nama || "Entri"}: ${STATUS_CONFIG[oldStatus]?.label || oldStatus} → ${STATUS_CONFIG[updated.status]?.label || updated.status}`,
              });
            }
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as DataEntry;
            if (role !== "super_admin" && role !== "admin" && user && (deleted as any).created_by !== user.id) return;
            setEntries((prev) => prev.filter((e) => e.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId]);

  if (!group) return <div className="text-muted-foreground">Memuat...</div>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">{group.name}</h1>

      <Tabs defaultValue="entries">
        <TabsList>
          <TabsTrigger value="entries" className="gap-2"><FileText className="h-4 w-4" /> Data Entri</TabsTrigger>
          {(role === "super_admin" || role === "admin" || role === "owner") && (
            <TabsTrigger value="members" className="gap-2"><Users className="h-4 w-4" /> Anggota</TabsTrigger>
          )}
          {(role === "super_admin" || role === "admin" || role === "owner") && (
            <TabsTrigger value="audit" className="gap-2" onClick={fetchAuditLogs}>
              <History className="h-4 w-4" /> Audit Log
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="entries" className="mt-4">
          {showEntryForm || editingEntry ? (
            <DataEntryForm
              groupId={groupId!}
              entry={editingEntry}
              onCancel={() => { setShowEntryForm(false); setEditingEntry(null); }}
              onSaved={handleEntrySaved}
            />
          ) : (
            <>
              <div className="mb-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {/* === TOMBOL CEK NIK - BUKA LANGSUNG DI TAB BARU === */}
                  <Button 
                    variant="outline" 
                    className="bg-white hover:bg-gray-50 text-blue-600 border-blue-200"
                    onClick={() => window.open('https://ui-login.oss.go.id/register', '_blank')}
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Cek NIK
                  </Button>
                  <Button onClick={() => setShowEntryForm(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Tambah Data
                  </Button>
                  {canDownload && selectedEntries.size > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => handleDownload([...selectedEntries])}
                      disabled={downloading}
                    >
                      {downloading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      Download {selectedEntries.size} data
                    </Button>
                  )}
                  {canDownload && (
                    <Button variant="outline" onClick={handleExportCsv}>
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Export CSV{selectedEntries.size > 0 ? ` (${selectedEntries.size})` : ""}
                    </Button>
                  )}
                  {canChangeStatus && selectedEntries.size > 0 && (
                    <Select onValueChange={handleBulkStatusChange}>
                      <SelectTrigger className="w-[200px]">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        <SelectValue placeholder={`Ubah status (${selectedEntries.size})`} />
                      </SelectTrigger>
                      <SelectContent>
                        {allowedStatuses.map((key) => {
                          const cfg = STATUS_CONFIG[key];
                          if (!cfg) return null;
                          return (
                            <SelectItem key={key} value={key}>
                              <span className="flex items-center gap-1">
                                <cfg.icon className="h-3 w-3" />
                                {cfg.label}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cari nama atau alamat..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter} disabled={isAdminInput}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                      {!isAdminInput && <SelectItem value="all">Semua Status</SelectItem>}
                      {Object.entries(STATUS_CONFIG)
                        .filter(([key]) => !isAdminInput || key === "siap_input")
                        .map(([key, cfg]) => (
                          <SelectItem key={key} value={key}>
                            <span className="flex items-center gap-1">
                              <cfg.icon className="h-3 w-3" />
                              {cfg.label}
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {filteredEntries.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    {entries.length === 0 ? "Belum ada data" : "Tidak ada data yang cocok dengan filter"}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-0 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {(canDownload || canChangeStatus) && (
                            <TableHead className="w-10">
                              <Checkbox
                                checked={selectedEntries.size === entries.length && entries.length > 0}
                                onCheckedChange={toggleAll}
                              />
                            </TableHead>
                          )}
                          <TableHead>Nama</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Email Halal</TableHead>
                          <TableHead>Sandi Halal</TableHead>
                          <TableHead>Email NIB</TableHead>
                          <TableHead>Sandi NIB</TableHead>
                          <TableHead>Alamat</TableHead>
                          <TableHead>No HP</TableHead>
                          <TableHead>KTP</TableHead>
                          <TableHead>NIB</TableHead>
                          <TableHead>Sertifikat</TableHead>
                          <TableHead>Tracking</TableHead>
                          <TableHead>Produk</TableHead>
                          <TableHead>Verifikasi</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEntries.map((e) => (
                          <TableRow key={e.id}>
                            {(canDownload || canChangeStatus) && (
                              <TableCell onClick={(ev) => ev.stopPropagation()}>
                                <Checkbox
                                  checked={selectedEntries.has(e.id)}
                                  onCheckedChange={() => toggleEntry(e.id)}
                                />
                              </TableCell>
                            )}
                            <TableCell className="font-medium cursor-pointer" onClick={() => setEditingEntry(e)}>{e.nama || "-"}</TableCell>
                            <TableCell>
                              {canChangeStatus ? (
                                <Select
                                  value={(e as any).status || "belum_lengkap"}
                                  onValueChange={(v) => handleStatusChange(e.id, v)}
                                >
                                  <SelectTrigger className="h-8 w-[170px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {/* Always show current status */}
                                    {(() => {
                                      const currentStatus = (e as any).status || "belum_lengkap";
                                      const statusesToShow = new Set([currentStatus, ...allowedStatuses]);
                                      return [...statusesToShow].map((key) => {
                                        const cfg = STATUS_CONFIG[key];
                                        if (!cfg) return null;
                                        return (
                                          <SelectItem key={key} value={key}>
                                            <span className="flex items-center gap-1">
                                              <cfg.icon className="h-3 w-3" />
                                              {cfg.label}
                                            </span>
                                          </SelectItem>
                                        );
                                      });
                                    })()}
                                  </SelectContent>
                                </Select>
                              ) : (
                                (() => {
                                  const cfg = STATUS_CONFIG[(e as any).status || "belum_lengkap"];
                                  if (!cfg) return <Badge variant="outline">{(e as any).status}</Badge>;
                                  return <Badge variant={cfg.variant}><cfg.icon className="mr-1 h-3 w-3" />{cfg.label}</Badge>;
                                })()
                              )}
                            </TableCell>
                            <TableCell className="max-w-[150px] truncate cursor-pointer" onClick={() => setEditingEntry(e)}>{(e as any).email_halal || "-"}</TableCell>
                            <TableCell className="cursor-pointer" onClick={() => setEditingEntry(e)}>{(e as any).sandi_halal || "-"}</TableCell>
                            <TableCell className="max-w-[150px] truncate cursor-pointer" onClick={() => setEditingEntry(e)}>{(e as any).email_nib || "-"}</TableCell>
                            <TableCell className="cursor-pointer" onClick={() => setEditingEntry(e)}>{(e as any).sandi_nib || "-"}</TableCell>
                            <TableCell className="max-w-[150px] truncate cursor-pointer" onClick={() => setEditingEntry(e)}>{e.alamat || "-"}</TableCell>
                            <TableCell className="cursor-pointer" onClick={() => setEditingEntry(e)}>{e.nomor_hp || "-"}</TableCell>
                            <TableCell>{e.ktp_url ? <Badge variant="secondary">✓</Badge> : "-"}</TableCell>
                            <TableCell>{e.nib_url ? <Badge variant="secondary">✓</Badge> : "-"}</TableCell>
                            <TableCell>{(e as any).sertifikat_url ? <Badge variant="secondary">✓</Badge> : "-"}</TableCell>
                            <TableCell>
                              <code className="text-xs font-mono text-muted-foreground">{(e as any).tracking_code || "-"}</code>
                            </TableCell>
                            <TableCell>
                              {((photoCounts[e.id]?.produk || 0) > 0 || e.foto_produk_url) ? (
                                <PhotoGallery
                                  entryId={e.id}
                                  legacyProdukUrl={e.foto_produk_url}
                                  legacyVerifikasiUrl={e.foto_verifikasi_url}
                                  photoType="produk"
                                  trigger={<Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">{photoCounts[e.id]?.produk || 1} foto</Badge>}
                                />
                              ) : "-"}
                            </TableCell>
                            <TableCell>
                              {((photoCounts[e.id]?.verifikasi || 0) > 0 || e.foto_verifikasi_url) ? (
                                <PhotoGallery
                                  entryId={e.id}
                                  legacyProdukUrl={e.foto_produk_url}
                                  legacyVerifikasiUrl={e.foto_verifikasi_url}
                                  photoType="verifikasi"
                                  trigger={<Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">{photoCounts[e.id]?.verifikasi || 1} foto</Badge>}
                                />
                              ) : "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {(role === "super_admin" || role === "admin") && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setLinkUmkmEntryId(e.id);
                                      setSelectedUmkmUserId((e as any).umkm_user_id || "");
                                      setLinkUmkmOpen(true);
                                      fetchUmkmUsers();
                                    }}
                                    title="Hubungkan ke akun UMKM"
                                  >
                                    <Link2 className="h-4 w-4" />
                                  </Button>
                                )}
                                {canDownload && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDownload([e.id])}
                                    disabled={downloading}
                                    title="Download entri ini"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                )}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Hapus Entri</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Yakin ingin menghapus data "{e.nama || "ini"}"? Tindakan ini tidak bisa dibatalkan.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Batal</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteEntry(e.id)}>Hapus</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {(role === "super_admin" || role === "admin" || role === "owner") && (
          <TabsContent value="members" className="mt-4">
            {(role === "super_admin" || role === "owner") && (
              <div className="mb-4">
                <Dialog open={addMemberOpen} onOpenChange={(o) => { 
                  setAddMemberOpen(o); 
                  if (o) {
                    fetchAvailableUsers();
                    setMemberSearchQuery("");
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button><Plus className="mr-2 h-4 w-4" /> Tambah Anggota</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Tambah Anggota</DialogTitle>
                      <DialogDescription>Cari dan pilih user untuk ditambahkan ke grup.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Cari nama atau email..."
                          className="pl-8"
                          value={memberSearchQuery}
                          onChange={(e) => setMemberSearchQuery(e.target.value)}
                        />
                      </div>
                      
                      <ScrollArea className="h-[200px] rounded-md border p-2">
                        <div className="space-y-1">
                          {filteredAvailableUsers.length > 0 ? (
                            filteredAvailableUsers.map((u) => (
                              <div
                                key={u.id}
                                className={cn(
                                  "flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                                  selectedUserId === u.id && "bg-accent text-accent-foreground"
                                )}
                                onClick={() => setSelectedUserId(u.id)}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{u.full_name || "Tanpa Nama"}</span>
                                  <span className="text-xs text-muted-foreground">{u.email}</span>
                                </div>
                                {selectedUserId === u.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                              </div>
                            ))
                          ) : (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                              {memberSearchQuery ? "User tidak ditemukan" : "Tidak ada user tersedia"}
                            </div>
                          )}
                        </div>
                      </ScrollArea>

                      <Button 
                        className="w-full" 
                        onClick={handleAddMember} 
                        disabled={!selectedUserId}
                      >
                        Tambahkan Anggota
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      {(role === "super_admin" || role === "owner") && <TableHead className="w-16"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.full_name || "-"}</TableCell>
                        <TableCell>{m.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{m.role?.replace("_", " ") ?? "-"}</Badge>
                        </TableCell>
                        {(role === "super_admin" || role === "owner") && (
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveMember(m.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {members.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Belum ada anggota
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {(role === "super_admin" || role === "admin" || role === "owner") && (
          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Riwayat Perubahan Status
                </CardTitle>
                <Button variant="outline" size="sm" onClick={fetchAuditLogs} disabled={auditLoading}>
                  {auditLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  <span className="ml-1">Refresh</span>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {auditLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">
                    Belum ada perubahan status yang tercatat
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nama Peserta</TableHead>
                          <TableHead>Perubahan Status</TableHead>
                          <TableHead>Diubah Oleh</TableHead>
                          <TableHead>Waktu</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.map((log) => {
                          const oldCfg = log.old_status ? STATUS_CONFIG[log.old_status] : null;
                          const newCfg = STATUS_CONFIG[log.new_status];
                          return (
                            <TableRow key={log.id}>
                              <TableCell className="font-medium">{log.entry_name || "-"}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {oldCfg ? (
                                    <Badge variant={oldCfg.variant} className="text-xs">
                                      <oldCfg.icon className="mr-1 h-3 w-3" />
                                      {oldCfg.label}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs">—</Badge>
                                  )}
                                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                  {newCfg ? (
                                    <Badge variant={newCfg.variant} className="text-xs">
                                      <newCfg.icon className="mr-1 h-3 w-3" />
                                      {newCfg.label}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs">{log.new_status}</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{log.changer_name ?? "—"}</TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                {new Date(log.changed_at).toLocaleString("id-ID", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Link UMKM Dialog */}
      <Dialog open={linkUmkmOpen} onOpenChange={(o) => { setLinkUmkmOpen(o); if (!o) { setLinkUmkmEntryId(null); setSelectedUmkmUserId(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hubungkan ke Akun UMKM</DialogTitle>
            <DialogDescription>Pilih akun UMKM untuk dihubungkan dengan entri ini.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedUmkmUserId || "__none__"} onValueChange={(v) => setSelectedUmkmUserId(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Pilih akun UMKM..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Tidak ada —</SelectItem>
                {umkmUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.email || u.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="w-full" onClick={handleLinkUmkm} disabled={linkingUmkm}>
              {linkingUmkm ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
