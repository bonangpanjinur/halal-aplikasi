import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Save, X, Loader2 } from "lucide-react";

interface PaymentMethod {
  id: string;
  name: string;
  description: string | null;
  account_name: string | null;
  account_number: string | null;
  bank_code: string | null;
  is_active: boolean;
  display_order: number;
}

export default function PaymentMethodsManagement() {
  const { role } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  
  const [formData, setFormData] = useState<Partial<PaymentMethod>>({
    name: "",
    description: "",
    account_name: "",
    account_number: "",
    bank_code: "",
    is_active: true,
    display_order: 0,
  });

  const fetchPaymentMethods = async () => {
    try {
      const { data, error } = await (supabase
        .from("payment_methods" as any)
        .select("*")
        .order("display_order", { ascending: true }) as any);
      
      if (error) throw error;
      setPaymentMethods(data || []);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      toast({ title: "Gagal memuat metode pembayaran", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role !== "super_admin") return;
    fetchPaymentMethods();
  }, [role]);

  const handleSave = async () => {
    if (!formData.name || !formData.bank_code) {
      toast({ title: "Nama dan Kode Bank harus diisi", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await (supabase
          .from("payment_methods" as any)
          .update({
            name: formData.name,
            description: formData.description,
            account_name: formData.account_name,
            account_number: formData.account_number,
            bank_code: formData.bank_code,
            is_active: formData.is_active,
            display_order: formData.display_order,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId) as any);
        
        if (error) throw error;
        toast({ title: "Metode pembayaran berhasil diperbarui" });
      } else {
        const { error } = await (supabase
          .from("payment_methods" as any)
          .insert([{
            name: formData.name,
            description: formData.description,
            account_name: formData.account_name,
            account_number: formData.account_number,
            bank_code: formData.bank_code,
            is_active: formData.is_active,
            display_order: formData.display_order,
          }]) as any);
        
        if (error) throw error;
        toast({ title: "Metode pembayaran berhasil ditambahkan" });
      }
      
      setOpenDialog(false);
      setEditingId(null);
      setFormData({
        name: "", description: "", account_name: "", account_number: "",
        bank_code: "", is_active: true, display_order: 0,
      });
      fetchPaymentMethods();
    } catch (error) {
      console.error("Error saving payment method:", error);
      toast({ title: "Gagal menyimpan metode pembayaran", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (method: PaymentMethod) => {
    setFormData(method);
    setEditingId(method.id);
    setOpenDialog(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await (supabase
        .from("payment_methods" as any)
        .delete()
        .eq("id", id) as any);
      
      if (error) throw error;
      toast({ title: "Metode pembayaran berhasil dihapus" });
      fetchPaymentMethods();
    } catch (error) {
      console.error("Error deleting payment method:", error);
      toast({ title: "Gagal menghapus metode pembayaran", variant: "destructive" });
    }
  };

  const handleOpenDialog = () => {
    setEditingId(null);
    setFormData({
      name: "", description: "", account_name: "", account_number: "",
      bank_code: "", is_active: true, display_order: 0,
    });
    setOpenDialog(true);
  };

  if (role !== "super_admin") {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Hanya Super Admin yang dapat mengakses halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manajemen Metode Pembayaran</h1>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenDialog} className="gap-2">
              <Plus className="h-4 w-4" /> Tambah Metode Pembayaran
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Metode Pembayaran" : "Tambah Metode Pembayaran Baru"}</DialogTitle>
              <DialogDescription>
                {editingId ? "Ubah informasi metode pembayaran" : "Tambahkan metode pembayaran baru untuk owner"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nama Metode *</Label>
                  <Input value={formData.name || ""} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Contoh: Bank Transfer - BCA" />
                </div>
                <div className="space-y-2">
                  <Label>Kode Bank *</Label>
                  <Input value={formData.bank_code || ""} onChange={(e) => setFormData({ ...formData, bank_code: e.target.value })} placeholder="Contoh: BCA, MANDIRI" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Deskripsi</Label>
                <Input value={formData.description || ""} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Deskripsi metode pembayaran" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nama Akun</Label>
                  <Input value={formData.account_name || ""} onChange={(e) => setFormData({ ...formData, account_name: e.target.value })} placeholder="Contoh: PT HalalTrack" />
                </div>
                <div className="space-y-2">
                  <Label>Nomor Akun</Label>
                  <Input value={formData.account_number || ""} onChange={(e) => setFormData({ ...formData, account_number: e.target.value })} placeholder="Contoh: 1234567890" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Urutan Tampil</Label>
                  <Input type="number" value={formData.display_order || 0} onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center gap-2 pt-2">
                    <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="rounded border-gray-300" />
                    <span className="text-sm">{formData.is_active ? "Aktif" : "Nonaktif"}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setOpenDialog(false)} disabled={saving}>
                  <X className="h-4 w-4 mr-2" /> Batal
                </Button>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Menyimpan..." : "Simpan"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Metode Pembayaran</CardTitle>
          <CardDescription>Kelola metode pembayaran yang tersedia untuk owner</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Metode</TableHead>
                <TableHead>Kode Bank</TableHead>
                <TableHead>Nama Akun</TableHead>
                <TableHead>Nomor Akun</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Memuat...</TableCell></TableRow>
              ) : paymentMethods.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Belum ada metode pembayaran</TableCell></TableRow>
              ) : (
                paymentMethods.map((method) => (
                  <TableRow key={method.id}>
                    <TableCell className="font-medium">{method.name}</TableCell>
                    <TableCell className="text-sm">{method.bank_code}</TableCell>
                    <TableCell className="text-sm">{method.account_name || "-"}</TableCell>
                    <TableCell className="text-sm font-mono">{method.account_number || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={method.is_active ? "default" : "secondary"}>
                        {method.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(method)} title="Edit">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Hapus">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus Metode Pembayaran</AlertDialogTitle>
                              <AlertDialogDescription>Yakin ingin menghapus {method.name}? Tindakan ini tidak bisa dibatalkan.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(method.id)}>Hapus</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
