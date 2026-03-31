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
import { Loader2, Save, Palette, Type, Image as ImageIcon, ShieldCheck, Wallet, ClipboardCheck, Building2, Edit2, CreditCard, CheckCircle2, Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAllFieldAccess } from "@/hooks/useFieldAccess";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

interface OwnerProfile {
  id: string;
  full_name: string;
  email: string;
  platform_fee_per_entry: number;
}

interface PaymentMethod {
  id: string;
  name: string;
  description: string | null;
  account_name: string | null;
  account_number: string | null;
  bank_code: string | null;
  is_active: boolean;
}

interface OwnerPaymentMethod {
  id: string;
  owner_id: string;
  payment_method_id: string;
  is_preferred: boolean;
  payment_methods?: PaymentMethod;
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
  // const [savingRates, setSavingRates] = useState(false);
  const [savingSiapInput, setSavingSiapInput] = useState(false);
  const [defaultPlatformFee, setDefaultPlatformFee] = useState(0);
  const [savingDefaultFee, setSavingDefaultFee] = useState(false);

  const [siapInputFields, setSiapInputFields] = useState<string[]>(["nama", "ktp", "nib", "foto_produk", "foto_verifikasi"]);
  // const [rates, setRates] = useState<Record<string, number>>({
  //   super_admin: 0,
  //   owner: 0,
  //   admin: 5000,
  //   admin_input: 0,
  //   lapangan: 10000,
  //   nib: 5000,
  // });

  const [owners, setOwners] = useState<OwnerProfile[]>([]);
  const [loadingOwners, setLoadingOwners] = useState(false);
  const [editingOwner, setEditingOwner] = useState<OwnerProfile | null>(null);
  const [editFee, setEditFee] = useState(0);
  const [savingFee, setSavingFee] = useState(false);

  // Payment Methods State
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [ownerMethods, setOwnerMethods] = useState<OwnerPaymentMethod[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);

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
          if (row.key === "default_platform_fee") setDefaultPlatformFee(parseInt(row.value ?? "0"));
        });
      }
    };
    load();
  }, []);

  // useEffect(() => {
  //   const loadRates = async () => {
  //     let query = supabase.from("commission_rates").select("role, amount_per_entry");
  //     if (isOwner && user) {
  //       query = query.eq("owner_id", user.id);
  //     } else {
  //       query = query.is("owner_id", null);
  //     }
  //     const { data } = await query;
  //     if (data) {
  //       const r: Record<string, number> = {};
  //       data.forEach((row: any) => { r[row.role] = row.amount_per_entry; });
  //       setRates(r);
  //     }
  //   };
  //   loadRates();
  // }, [isOwner, user]);

  const fetchOwners = async () => {
    if (!isSuperAdmin) return;
    setLoadingOwners(true);
    try {
      // Step 1: Get all user IDs that have the 'owner' role
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "owner");
      
      if (rolesError) throw rolesError;
      
      const ownerIds = rolesData?.map(r => r.user_id) || [];
      
      if (ownerIds.length === 0) {
        setOwners([]);
        return;
      }

      // Step 2: Get profiles for those specific IDs
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, platform_fee_per_entry")
        .in("id", ownerIds);
      
      if (profilesError) throw profilesError;
      
      const formattedOwners = (profilesData || []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name || "Tanpa Nama",
        email: p.email || "No Email",
        platform_fee_per_entry: Number(p.platform_fee_per_entry) || 0
      }));
      
      setOwners(formattedOwners);
    } catch (error: any) {
      console.error("Error fetching owners:", error);
      toast({ 
        title: "Gagal memuat data owner", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setLoadingOwners(false);
    }
  };

  const fetchPaymentMethods = async () => {
    if (!isOwner || !user) return;
    setLoadingPayments(true);
    try {
      const { data: methods } = await (supabase
        .from("payment_methods" as any)
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true }) as any);
      setPaymentMethods(methods || []);

      const { data: ownerMethodsData } = await (supabase
        .from("owner_payment_methods" as any)
        .select("*, payment_methods(*)")
        .eq("owner_id", user.id) as any);
      setOwnerMethods(ownerMethodsData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) fetchOwners();
    if (isOwner) fetchPaymentMethods();
  }, [isSuperAdmin, isOwner, user]);

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
    try {
      for (const [r, amount] of Object.entries(rates)) {
        const payload: any = { role: r, amount_per_entry: amount, updated_at: new Date().toISOString() };
        if (isOwner && user) payload.owner_id = user.id;
        await supabase.from("commission_rates").upsert(payload, { onConflict: isOwner ? "role,owner_id" : "role" });
      }
      toast({ title: "Tarif komisi berhasil disimpan" });
    } catch (error: any) {
      console.error("Error saving rates:", error);
      toast({ title: "Gagal menyimpan tarif", description: error.message, variant: "destructive" });
    } finally {
      setSavingRates(false);
    }
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

  const handleSaveDefaultPlatformFee = async () => {
    setSavingDefaultFee(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "default_platform_fee", value: defaultPlatformFee.toString(), updated_at: new Date().toISOString() }, { onConflict: "key" });
    setSavingDefaultFee(false);
    if (error) {
      toast({ title: "Gagal simpan tarif default", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Tarif platform default diperbarui" });
    }
  };

  const handleTogglePaymentMethod = async (methodId: string, isSelected: boolean) => {
    if (!user) return;
    setSavingPayment(true);
    try {
      if (isSelected) {
        await (supabase.from("owner_payment_methods" as any).delete().eq("owner_id", user.id).eq("payment_method_id", methodId) as any);
        toast({ title: "Metode pembayaran dihapus" });
      } else {
        await (supabase.from("owner_payment_methods" as any).insert([{ owner_id: user.id, payment_method_id: methodId, is_preferred: ownerMethods.length === 0 }]) as any);
        toast({ title: "Metode pembayaran ditambahkan" });
      }
      fetchPaymentMethods();
    } catch (e) {
      toast({ title: "Gagal memperbarui", variant: "destructive" });
    } finally {
      setSavingPayment(false);
    }
  };

  const handleSetPreferredPayment = async (ownerMethodId: string) => {
    if (!user) return;
    setSavingPayment(true);
    try {
      await (supabase.from("owner_payment_methods" as any).update({ is_preferred: false }).eq("owner_id", user.id) as any);
      await (supabase.from("owner_payment_methods" as any).update({ is_preferred: true }).eq("id", ownerMethodId) as any);
      toast({ title: "Metode utama diperbarui" });
      fetchPaymentMethods();
    } catch (e) {
      toast({ title: "Gagal memperbarui", variant: "destructive" });
    } finally {
      setSavingPayment(false);
    }
  };

  if (role !== "super_admin" && role !== "owner") {
    return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Hanya Super Admin / Owner yang bisa mengakses halaman ini.</p></div>;
  }

  const selectedPaymentIds = new Set(ownerMethods.map(m => m.payment_method_id));

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pengaturan</h1>
          <p className="text-muted-foreground mt-1">Kelola konfigurasi aplikasi, hak akses, dan tarif platform.</p>
        </div>
      </div>

        <Tabs defaultValue={isOwner ? "pembayaran" : "tampilan"} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto p-1 bg-muted/50">
          {!isOwner && <TabsTrigger value="tampilan" className="gap-2 py-2.5"><Palette className="h-4 w-4" /> Tampilan</TabsTrigger>}
          {!isOwner && <TabsTrigger value="akses" className="gap-2 py-2.5"><ShieldCheck className="h-4 w-4" /> Hak Akses</TabsTrigger>}
          {!isOwner && <TabsTrigger value="siap_input" className="gap-2 py-2.5"><ClipboardCheck className="h-4 w-4" /> Siap Input</TabsTrigger>}
          {/* {isOwner && <TabsTrigger value="komisi" className="gap-2 py-2.5"><Wallet className="h-4 w-4" /> Komisi Tim</TabsTrigger>} */}
          {isSuperAdmin && <TabsTrigger value="tarif_platform" className="gap-2 py-2.5"><Building2 className="h-4 w-4" /> Tarif Platform Owner</TabsTrigger>}
          {isOwner && <TabsTrigger value="pembayaran" className="gap-2 py-2.5"><CreditCard className="h-4 w-4" /> Pembayaran</TabsTrigger>}
        </TabsList>

        {/* Tampilan Tab */}
        <TabsContent value="tampilan" className="space-y-6 outline-none">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-none shadow-md">
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Type className="h-5 w-5 text-primary" /> Nama Aplikasi</CardTitle></CardHeader>
              <CardContent><Input value={appName} onChange={(e) => setAppName(e.target.value)} className="h-11" /></CardContent>
            </Card>
            <Card className="border-none shadow-md">
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ImageIcon className="h-5 w-5 text-primary" /> Logo Aplikasi</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  {logoUrl && <img src={logoUrl} alt="Logo" className="h-12 w-12 rounded-lg object-contain border p-1" />}
                  <Input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploading} className="cursor-pointer" />
                </div>
              </CardContent>
            </Card>
          </div>
          <Card className="border-none shadow-md">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Palette className="h-5 w-5 text-primary" /> Warna Tema Utama</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                {COLOR_PRESETS.map((p) => (
                  <button 
                    key={p.value} 
                    onClick={() => setPrimaryColor(p.value)} 
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all hover:bg-accent",
                      primaryColor === p.value ? "border-primary bg-primary/5" : "border-transparent"
                    )}
                  >
                    <div className="h-10 w-10 rounded-full shadow-inner" style={{ backgroundColor: `hsl(${p.value})` }} />
                    <span className="text-xs font-medium">{p.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
          <Button onClick={handleSave} disabled={saving} className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20">
            {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
            Simpan Perubahan Tampilan
          </Button>
        </TabsContent>

        {/* Hak Akses Tab */}
        <TabsContent value="akses" className="space-y-6 outline-none">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Konfigurasi Hak Akses Field</CardTitle>
              <CardDescription>Atur field mana saja yang bisa dilihat dan diedit oleh setiap role.</CardDescription>
            </CardHeader>
            <CardContent>
              {accessLoading ? <div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
                <div className="space-y-8">
                  {ALL_ROLES.map(r => (
                    <div key={r.key} className="space-y-4">
                      <div className="flex items-center gap-2 border-b pb-2">
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-sm px-3">{r.label}</Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {FIELDS.map(f => (
                          <div key={f.key} className="flex items-center justify-between p-3 border rounded-xl bg-card hover:bg-accent/30 transition-colors">
                            <span className="text-sm font-medium">{f.label}</span>
                            <div className="flex items-center gap-4">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] text-muted-foreground uppercase font-bold">Lihat</span>
                                <Switch checked={localAccess[r.key]?.[f.key]?.can_view} onCheckedChange={() => toggleAccess(r.key, f.key, "can_view")} />
                              </div>
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] text-muted-foreground uppercase font-bold">Edit</span>
                                <Switch checked={localAccess[r.key]?.[f.key]?.can_edit} onCheckedChange={() => toggleAccess(r.key, f.key, "can_edit")} />
                              </div>
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
          <Button onClick={handleSaveAccess} disabled={savingAccess} className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20">
            {savingAccess ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
            Simpan Konfigurasi Hak Akses
          </Button>
        </TabsContent>

        {/* Siap Input Tab */}
        <TabsContent value="siap_input" className="space-y-6 outline-none">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" /> Syarat Status Siap Input</CardTitle>
              <CardDescription>Pilih field mana saja yang wajib diisi agar status otomatis berubah menjadi "Siap Input".</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {FIELDS.map(f => (
                <div key={f.key} className={cn(
                  "flex items-center gap-3 p-4 border rounded-xl transition-all cursor-pointer",
                  siapInputFields.includes(f.key) ? "border-primary bg-primary/5" : "hover:bg-accent"
                )} onClick={() => setSiapInputFields(prev => siapInputFields.includes(f.key) ? prev.filter(k => k !== f.key) : [...prev, f.key])}>
                  <Checkbox checked={siapInputFields.includes(f.key)} />
                  <span className="text-sm font-medium">{f.label}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Button onClick={async () => { setSavingSiapInput(true); await supabase.from("app_settings").upsert({ key: "siap_input_required_fields", value: JSON.stringify(siapInputFields) }, { onConflict: "key" }); setSavingSiapInput(false); toast({ title: "Berhasil disimpan" }); }} disabled={savingSiapInput} className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20">
            {savingSiapInput ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
            Simpan Syarat Siap Input
          </Button>
        </TabsContent>

        {/* Komisi Tab (Owner Only) - Removed as it's redundant with User Management settings */}
        {/* {isOwner && (
          <TabsContent value="komisi" className="space-y-6 outline-none">
            ...
          </TabsContent>
        )} */}

        {/* Tarif Platform Tab (Super Admin Only) */}
        {isSuperAdmin && (
          <TabsContent value="tarif_platform" className="space-y-6 outline-none">
            <Card className="border-none shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Wallet className="h-5 w-5 text-primary" /> Tarif Platform Default</CardTitle>
                <CardDescription>Atur tarif standar yang akan dikenakan kepada setiap owner baru secara otomatis.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-end gap-4">
                <div className="flex-1 space-y-2">
                  <Label className="text-sm font-bold">Harga per Sertifikat (Rp)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">Rp</span>
                    <Input type="number" value={defaultPlatformFee} onChange={(e) => setDefaultPlatformFee(parseInt(e.target.value) || 0)} className="pl-10 h-11" />
                  </div>
                </div>
                <Button onClick={handleSaveDefaultPlatformFee} disabled={savingDefaultFee} className="h-11 px-8 font-semibold">
                  {savingDefaultFee ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Simpan Harga Default
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Building2 className="h-6 w-6 text-primary" /> 
                    Penyesuaian Tarif per Owner
                  </CardTitle>
                  <CardDescription>Kelola biaya platform khusus untuk masing-masing owner jika berbeda dari harga default.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchOwners} disabled={loadingOwners}>
                  {loadingOwners ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Refresh Data
                </Button>
              </CardHeader>
              <CardContent>
                {loadingOwners ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground font-medium">Memuat data owner...</p>
                  </div>
                ) : (
                  <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="font-bold h-12">Nama Owner</TableHead>
                          <TableHead className="font-bold h-12">Email Terdaftar</TableHead>
                          <TableHead className="font-bold h-12 text-right pr-8">Tarif Khusus / Sertifikat</TableHead>
                          <TableHead className="w-[100px] text-center font-bold h-12">Pengaturan</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {owners.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-16">
                              <div className="flex flex-col items-center gap-2">
                                <Users className="h-10 w-10 text-muted-foreground/30" />
                                <p className="text-muted-foreground font-medium">Tidak ada data owner ditemukan</p>
                                <p className="text-xs text-muted-foreground/60 max-w-[250px]">Pastikan sudah ada user dengan role 'owner' di sistem.</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          owners.map(o => (
                            <TableRow key={o.id} className="hover:bg-muted/20 transition-all border-b last:border-0 group">
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                    {o.full_name?.charAt(0).toUpperCase() || 'O'}
                                  </div>
                                  <span className="font-semibold text-foreground">{o.full_name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm font-medium">{o.email}</TableCell>
                              <TableCell className="text-right pr-8">
                                <Badge variant="outline" className="font-mono text-primary font-bold px-3 py-1 border-primary/20 bg-primary/5 text-base">
                                  Rp {o.platform_fee_per_entry?.toLocaleString() || 0}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Button 
                                  variant="secondary" 
                                  size="sm" 
                                  onClick={() => { setEditingOwner(o); setEditFee(o.platform_fee_per_entry || 0); }} 
                                  className="h-9 gap-2 font-semibold hover:bg-primary hover:text-primary-foreground transition-all shadow-sm"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                  Ubah Tarif
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Pembayaran Tab (Owner Only) */}
        {isOwner && (
          <TabsContent value="pembayaran" className="space-y-6 outline-none">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-none shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg"><CheckCircle2 className="h-5 w-5 text-emerald-500" /> Metode Pembayaran Saya</CardTitle>
                  <CardDescription>Metode yang Anda gunakan untuk menerima pembayaran.</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingPayments ? <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : ownerMethods.length === 0 ? (
                    <div className="py-10 text-center border-2 border-dashed rounded-xl">
                      <p className="text-sm text-muted-foreground">Belum ada metode yang dipilih.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {ownerMethods.map(m => (
                        <div key={m.id} className="p-4 border rounded-xl bg-card hover:shadow-sm transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-bold text-sm">{m.payment_methods?.name}</h3>
                            {m.is_preferred && <Badge className="bg-emerald-500 hover:bg-emerald-600">Utama</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>No: <span className="font-mono text-foreground">{m.payment_methods?.account_number}</span></p>
                            <p>A/N: <span className="font-medium text-foreground">{m.payment_methods?.account_name}</span></p>
                          </div>
                          <div className="flex gap-2 mt-4">
                            {!m.is_preferred && <Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => handleSetPreferredPayment(m.id)} disabled={savingPayment}>Set Utama</Button>}
                            <Button variant="destructive" size="sm" className="h-8 text-[10px]" onClick={() => handleTogglePaymentMethod(m.payment_method_id, true)} disabled={savingPayment}>Hapus</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg"><CreditCard className="h-5 w-5 text-primary" /> Pilih Metode Tersedia</CardTitle>
                  <CardDescription>Aktifkan metode pembayaran yang didukung.</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingPayments ? <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
                    <div className="space-y-2">
                      {paymentMethods.map(m => {
                        const isSelected = selectedPaymentIds.has(m.id);
                        return (
                          <div 
                            key={m.id} 
                            className={cn(
                              "flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all",
                              isSelected ? "border-primary bg-primary/5" : "hover:bg-accent"
                            )}
                            onClick={() => handleTogglePaymentMethod(m.id, isSelected)}
                          >
                            <Checkbox checked={isSelected} disabled={savingPayment} />
                            <div className="flex-1">
                              <p className="text-sm font-bold">{m.name}</p>
                              <p className="text-[10px] text-muted-foreground">{m.bank_code} {m.account_number ? `• ${m.account_number}` : ""}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Edit Platform Fee Dialog */}
      <Dialog open={!!editingOwner} onOpenChange={(o) => !o && setEditingOwner(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Edit Tarif Platform</DialogTitle>
            <CardDescription>Update biaya platform per sertifikat untuk owner {editingOwner?.full_name}.</CardDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-bold">Tarif per Sertifikat (Rp)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">Rp</span>
                <Input type="number" value={editFee} onChange={(e) => setEditFee(parseInt(e.target.value) || 0)} className="pl-10 h-12 text-lg font-mono" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditingOwner(null)} className="h-11 rounded-xl">Batal</Button>
            <Button onClick={handleSavePlatformFee} disabled={savingFee} className="h-11 rounded-xl px-8">
              {savingFee ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Simpan Tarif
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
