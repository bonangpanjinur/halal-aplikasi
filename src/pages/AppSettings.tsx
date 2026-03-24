import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, Palette, Type, Image as ImageIcon, ShieldCheck, Wallet, ClipboardCheck, Building2, Edit2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAllFieldAccess } from "@/hooks/useFieldAccess";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const COLOR_PRESETS = [
  { label: "Biru Profesional", value: "217 91% 50%" },
  { label: "Hijau Halal", value: "142 71% 40%" },
  { label: "Teal Modern", value: "174 72% 40%" },
  { label: "Ungu Elegan", value: "262 83% 58%" },
  { label: "Oranye Hangat", value: "25 95% 53%" },
  { label: "Merah Tegas", value: "0 84% 50%" },
];

const ALL_ROLES = [
  { key: "super_admin", label: "Super Admin" },
  { key: "owner", label: "Owner" },
  { key: "admin", label: "Admin" },
  { key: "admin_input", label: "Admin Input" },
  { key: "lapangan", label: "Lapangan" },
  { key: "nib", label: "NIB" },
  { key: "umkm", label: "UMKM" },
];

const FIELDS = [
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
];

const STATUS_OPTIONS = [
  { key: "status:belum_lengkap", label: "→ Belum Lengkap" },
  { key: "status:siap_input", label: "→ Siap Input" },
  { key: "status:ktp_terdaftar_nib", label: "→ KTP Terdaftar NIB" },
  { key: "status:revisi", label: "→ Revisi" },
  { key: "status:selesai_revisi", label: "→ Selesai Revisi" },
  { key: "status:pengajuan", label: "→ Pengajuan" },
  { key: "status:sertifikat_selesai", label: "→ Sertifikat Selesai" },
];

interface OwnerProfile {
  id: string;
  full_name: string;
  email: string;
  platform_fee_per_entry: number;
}

export default function AppSettings() {
  const { role, user } = useAuth();
  const isSuperAdmin = role === "super_admin";
  const isOwner = role === "owner";
  const [appName, setAppName] = useState("HalalTrack");
  const [primaryColor, setPrimaryColor] = useState("217 91% 50%");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [savingRates, setSavingRates] = useState(false);
  const [savingSiapInput, setSavingSiapInput] = useState(false);

  const [siapInputFields, setSiapInputFields] = useState<string[]>(["nama", "ktp", "nib", "foto_produk", "foto_verifikasi"]);
  const [rates, setRates] = useState<Record<string, number>>({
    super_admin: 0,
    owner: 0,
    admin: 5000,
    admin_input: 0,
    lapangan: 10000,
    nib: 5000,
  });

  const [owners, setOwners] = useState<OwnerProfile[]>([]);
  const [loadingOwners, setLoadingOwners] = useState(false);
  const [editingOwner, setEditingOwner] = useState<OwnerProfile | null>(null);
  const [editFee, setEditFee] = useState(0);
  const [savingFee, setSavingFee] = useState(false);

  const { allAccess, loading: accessLoading, refetch: refetchAccess } = useAllFieldAccess();
  const [localAccess, setLocalAccess] = useState<Record<string, Record<string, { can_view: boolean; can_edit: boolean }>>>({});

  useEffect(() => {
    if (Object.keys(allAccess).length > 0) {
      const mapped: Record<string, Record<string, { can_view: boolean; can_edit: boolean }>> = {};
      for (const [r, fields] of Object.entries(allAccess)) {
        mapped[r] = {};
        fields.forEach((f) => {
          mapped[r][f.field_name] = { can_view: f.can_view, can_edit: f.can_edit };
        });
      }
      setLocalAccess(mapped);
    }
  }, [allAccess]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("app_settings").select("key, value");
      if (data) {
        data.forEach((row: any) => {
          if (row.key === "app_name") setAppName(row.value ?? "HalalTrack");
          if (row.key === "primary_color") setPrimaryColor(row.value ?? "217 91% 50%");
          if (row.key === "logo_url") setLogoUrl(row.value ?? "");
          if (row.key === "siap_input_required_fields") {
            try { setSiapInputFields(JSON.parse(row.value ?? "[]")); } catch {}
          }
        });
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadRates = async () => {
      let query = supabase.from("commission_rates").select("role, amount_per_entry");
      if (isOwner && user) {
        query = query.eq("owner_id", user.id);
      } else {
        query = query.is("owner_id", null);
      }
      const { data } = await query;
      if (data) {
        const r: Record<string, number> = {};
        data.forEach((row: any) => { r[row.role] = row.amount_per_entry; });
        setRates(r);
      }
    };
    loadRates();
  }, [isOwner, user]);

  const fetchOwners = async () => {
    if (!isSuperAdmin) return;
    setLoadingOwners(true);
    const { data: rolesData } = await supabase.from("user_roles").select("user_id").eq("role", "owner");
    const ownerIds = rolesData?.map(r => r.user_id) || [];
    
    if (ownerIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, email, platform_fee_per_entry")
        .in("id", ownerIds);
      setOwners(profilesData as any ?? []);
    }
    setLoadingOwners(false);
  };

  useEffect(() => {
    if (isSuperAdmin) fetchOwners();
  }, [isSuperAdmin]);

  useEffect(() => {
    document.documentElement.style.setProperty("--primary", primaryColor);
    return () => { document.documentElement.style.removeProperty("--primary"); };
  }, [primaryColor]);

  const handleSave = async () => {
    setSaving(true);
    const updates = [
      { key: "app_name", value: appName },
      { key: "primary_color", value: primaryColor },
      { key: "logo_url", value: logoUrl },
    ];
    for (const u of updates) {
      await supabase.from("app_settings").upsert({ key: u.key, value: u.value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    }
    setSaving(false);
    toast({ title: "Pengaturan berhasil disimpan" });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `logo/app-logo.${ext}`;
    const { error: uploadError } = await supabase.storage.from("product-photos").upload(path, file, { upsert: true });
    if (uploadError) {
      toast({ title: "Gagal upload logo", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("product-photos").getPublicUrl(path);
    setLogoUrl(urlData.publicUrl);
    setUploading(false);
    toast({ title: "Logo berhasil diupload" });
  };

  const toggleAccess = (roleKey: string, fieldKey: string, type: "can_view" | "can_edit") => {
    setLocalAccess((prev) => {
      const updated = { ...prev };
      if (!updated[roleKey]) updated[roleKey] = {};
      if (!updated[roleKey][fieldKey]) updated[roleKey][fieldKey] = { can_view: false, can_edit: false };
      updated[roleKey][fieldKey] = { ...updated[roleKey][fieldKey], [type]: !updated[roleKey][fieldKey][type] };
      if (type === "can_edit" && updated[roleKey][fieldKey].can_edit) updated[roleKey][fieldKey].can_view = true;
      if (type === "can_view" && !updated[roleKey][fieldKey].can_view) updated[roleKey][fieldKey].can_edit = false;
      return updated;
    });
  };

  const handleSaveAccess = async () => {
    setSavingAccess(true);
    const updates: any[] = [];
    for (const [r, fields] of Object.entries(localAccess)) {
      for (const [f, perms] of Object.entries(fields)) {
        updates.push({ role: r, field_name: f, can_view: perms.can_view, can_edit: perms.can_edit });
      }
    }
    for (const u of updates) {
      await supabase.from("field_access").upsert({ ...u, updated_at: new Date().toISOString() }, { onConflict: "role,field_name" });
    }
    setSavingAccess(false);
    refetchAccess();
    toast({ title: "Hak akses berhasil disimpan" });
  };

  const handleSaveRates = async () => {
    setSavingRates(true);
    for (const [r, amount] of Object.entries(rates)) {
      const payload: any = { role: r, amount_per_entry: amount, updated_at: new Date().toISOString() };
      if (isOwner && user) payload.owner_id = user.id;
      await supabase.from("commission_rates").upsert(payload, { onConflict: isOwner ? "role,owner_id" : "role" });
    }
    setSavingRates(false);
    toast({ title: "Tarif komisi berhasil disimpan" });
  };

  const handleSavePlatformFee = async () => {
    if (!editingOwner) return;
    setSavingFee(true);
    const { error } = await supabase
      .from("profiles")
      .update({ platform_fee_per_entry: editFee } as any)
      .eq("id", editingOwner.id);
    setSavingFee(false);
    if (error) {
      toast({ title: "Gagal simpan tarif", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Tarif platform diperbarui" });
      setEditingOwner(null);
      fetchOwners();
    }
  };

  if (role !== "super_admin" && role !== "owner") {
    return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Hanya Super Admin / Owner yang bisa mengakses halaman ini.</p></div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Pengaturan</h1>
      <Tabs defaultValue={isOwner ? "komisi" : "tampilan"}>
        <TabsList className="w-full flex-wrap">
          {!isOwner && <TabsTrigger value="tampilan" className="flex-1 gap-2"><Palette className="h-4 w-4" /> Tampilan</TabsTrigger>}
          {!isOwner && <TabsTrigger value="akses" className="flex-1 gap-2"><ShieldCheck className="h-4 w-4" /> Hak Akses</TabsTrigger>}
          {!isOwner && <TabsTrigger value="siap_input" className="flex-1 gap-2"><ClipboardCheck className="h-4 w-4" /> Siap Input</TabsTrigger>}
          <TabsTrigger value="komisi" className="flex-1 gap-2"><Wallet className="h-4 w-4" /> Komisi</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="tarif_platform" className="flex-1 gap-2"><Building2 className="h-4 w-4" /> Tarif Platform</TabsTrigger>}
        </TabsList>

        <TabsContent value="tampilan" className="space-y-6 mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Type className="h-5 w-5" /> Nama Aplikasi</CardTitle></CardHeader>
            <CardContent><Input value={appName} onChange={(e) => setAppName(e.target.value)} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Palette className="h-5 w-5" /> Warna Utama</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {COLOR_PRESETS.map((p) => (
                  <button key={p.value} onClick={() => setPrimaryColor(p.value)} className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 ${primaryColor === p.value ? "border-primary" : "border-transparent"}`}>
                    <div className="h-8 w-8 rounded-full" style={{ backgroundColor: `hsl(${p.value})` }} />
                    <span className="text-[10px]">{p.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
          <Button onClick={handleSave} disabled={saving} className="w-full"><Save className="mr-2 h-4 w-4" /> Simpan Tampilan</Button>
        </TabsContent>

        <TabsContent value="akses" className="space-y-6 mt-4">
          <Card>
            <CardHeader><CardTitle>Hak Akses Field</CardTitle></CardHeader>
            <CardContent>
              {accessLoading ? <Loader2 className="animate-spin mx-auto" /> : (
                <div className="space-y-6">
                  {ALL_ROLES.map(r => (
                    <div key={r.key} className="space-y-2">
                      <h3 className="font-bold border-b pb-1">{r.label}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {FIELDS.map(f => (
                          <div key={f.key} className="flex items-center justify-between p-2 border rounded">
                            <span className="text-sm">{f.label}</span>
                            <div className="flex gap-2">
                              <Switch checked={localAccess[r.key]?.[f.key]?.can_view} onCheckedChange={() => toggleAccess(r.key, f.key, "can_view")} />
                              <Switch checked={localAccess[r.key]?.[f.key]?.can_edit} onCheckedChange={() => toggleAccess(r.key, f.key, "can_edit")} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Button onClick={handleSaveAccess} disabled={savingAccess} className="w-full"><Save className="mr-2 h-4 w-4" /> Simpan Hak Akses</Button>
        </TabsContent>

        <TabsContent value="siap_input" className="space-y-6 mt-4">
          <Card>
            <CardHeader><CardTitle>Syarat Siap Input</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FIELDS.map(f => (
                <div key={f.key} className="flex items-center gap-2 p-2 border rounded">
                  <Checkbox checked={siapInputFields.includes(f.key)} onCheckedChange={(c) => setSiapInputFields(prev => c ? [...prev, f.key] : prev.filter(k => k !== f.key))} />
                  <span className="text-sm">{f.label}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Button onClick={async () => { setSavingSiapInput(true); await supabase.from("app_settings").upsert({ key: "siap_input_required_fields", value: JSON.stringify(siapInputFields) }, { onConflict: "key" }); setSavingSiapInput(false); toast({ title: "Berhasil" }); }} disabled={savingSiapInput} className="w-full"><Save className="mr-2 h-4 w-4" /> Simpan</Button>
        </TabsContent>

        <TabsContent value="komisi" className="space-y-6 mt-4">
          <Card>
            <CardHeader><CardTitle>Tarif Komisi per Entry</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(rates).map(([r, amount]) => (
                <div key={r} className="flex items-center gap-4">
                  <Label className="w-32 capitalize">{r.replace("_", " ")}</Label>
                  <Input type="number" value={amount} onChange={(e) => setRates(prev => ({ ...prev, [r]: parseInt(e.target.value) || 0 }))} />
                </div>
              ))}
            </CardContent>
          </Card>
          <Button onClick={handleSaveRates} disabled={savingRates} className="w-full"><Save className="mr-2 h-4 w-4" /> Simpan Tarif Komisi</Button>
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="tarif_platform" className="space-y-6 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Tarif Platform per Owner</CardTitle>
                <CardDescription>Atur biaya yang dikenakan ke owner untuk setiap data yang masuk</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingOwners ? <Loader2 className="animate-spin mx-auto" /> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Owner</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Tarif / Entry</TableHead>
                        <TableHead className="w-20">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {owners.map(o => (
                        <TableRow key={o.id}>
                          <TableCell className="font-medium">{o.full_name}</TableCell>
                          <TableCell>{o.email}</TableCell>
                          <TableCell>Rp {o.platform_fee_per_entry?.toLocaleString() || 0}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => { setEditingOwner(o); setEditFee(o.platform_fee_per_entry || 0); }}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={!!editingOwner} onOpenChange={(o) => !o && setEditingOwner(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Tarif Platform: {editingOwner?.full_name}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-2">
            <Label>Tarif per Entry (Rp)</Label>
            <Input type="number" value={editFee} onChange={(e) => setEditFee(parseInt(e.target.value) || 0)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOwner(null)}>Batal</Button>
            <Button onClick={handleSavePlatformFee} disabled={savingFee}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
