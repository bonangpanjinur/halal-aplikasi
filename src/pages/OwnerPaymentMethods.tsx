import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Loader2, CreditCard } from "lucide-react";

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

export default function OwnerPaymentMethods() {
  const { user, role } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [ownerMethods, setOwnerMethods] = useState<OwnerPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch all active payment methods
      const { data: methods, error: methodsError } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (methodsError) throw methodsError;
      setPaymentMethods(methods || []);

      // Fetch owner's selected payment methods
      const { data: ownerMethods, error: ownerError } = await supabase
        .from("owner_payment_methods")
        .select("*, payment_methods(*)")
        .eq("owner_id", user.id);

      if (ownerError) throw ownerError;
      setOwnerMethods(ownerMethods || []);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      toast({ title: "Gagal memuat metode pembayaran", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || role !== "owner") return;
    fetchData();
  }, [user, role]);

  const handleToggleMethod = async (methodId: string, isSelected: boolean) => {
    if (!user) return;

    setSaving(true);
    try {
      if (isSelected) {
        // Remove method
        const { error } = await supabase
          .from("owner_payment_methods")
          .delete()
          .eq("owner_id", user.id)
          .eq("payment_method_id", methodId);

        if (error) throw error;
        toast({ title: "Metode pembayaran dihapus" });
      } else {
        // Add method
        const { error } = await supabase
          .from("owner_payment_methods")
          .insert([{
            owner_id: user.id,
            payment_method_id: methodId,
            is_preferred: ownerMethods.length === 0, // Set as preferred if first one
          }]);

        if (error) throw error;
        toast({ title: "Metode pembayaran ditambahkan" });
      }

      fetchData();
    } catch (error) {
      console.error("Error updating payment method:", error);
      toast({ title: "Gagal memperbarui metode pembayaran", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSetPreferred = async (ownerMethodId: string) => {
    if (!user) return;

    setSaving(true);
    try {
      // Remove preferred from all
      await supabase
        .from("owner_payment_methods")
        .update({ is_preferred: false })
        .eq("owner_id", user.id);

      // Set this one as preferred
      const { error } = await supabase
        .from("owner_payment_methods")
        .update({ is_preferred: true })
        .eq("id", ownerMethodId);

      if (error) throw error;
      toast({ title: "Metode pembayaran utama berhasil diubah" });
      fetchData();
    } catch (error) {
      console.error("Error setting preferred method:", error);
      toast({ title: "Gagal mengubah metode pembayaran utama", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (role !== "owner") {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Hanya Owner yang dapat mengakses halaman ini.</p>
      </div>
    );
  }

  const selectedMethodIds = new Set(ownerMethods.map((m) => m.payment_method_id));
  const preferredMethod = ownerMethods.find((m) => m.is_preferred);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CreditCard className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Metode Pembayaran</h1>
      </div>

      {/* Selected Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle>Metode Pembayaran Saya</CardTitle>
          <CardDescription>Metode pembayaran yang telah Anda pilih</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : ownerMethods.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground mb-4">Belum ada metode pembayaran yang dipilih</p>
              <p className="text-sm text-muted-foreground">Pilih metode pembayaran di bawah untuk memulai</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ownerMethods.map((ownerMethod) => (
                <div
                  key={ownerMethod.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{ownerMethod.payment_methods?.name}</h3>
                      {ownerMethod.is_preferred && (
                        <Badge variant="default" className="text-xs">Utama</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {ownerMethod.payment_methods?.description}
                    </p>
                    {ownerMethod.payment_methods?.account_name && (
                      <p className="text-sm mt-2">
                        <span className="text-muted-foreground">Atas Nama: </span>
                        <span className="font-mono">{ownerMethod.payment_methods.account_name}</span>
                      </p>
                    )}
                    {ownerMethod.payment_methods?.account_number && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Nomor: </span>
                        <span className="font-mono">{ownerMethod.payment_methods.account_number}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    {!ownerMethod.is_preferred && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetPreferred(ownerMethod.id)}
                        disabled={saving}
                      >
                        Jadikan Utama
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleToggleMethod(ownerMethod.payment_method_id, true)}
                      disabled={saving}
                    >
                      Hapus
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle>Metode Pembayaran Tersedia</CardTitle>
          <CardDescription>Pilih metode pembayaran yang ingin Anda gunakan</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Nama Metode</TableHead>
                <TableHead>Kode Bank</TableHead>
                <TableHead>Nama Akun</TableHead>
                <TableHead>Nomor Akun</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Memuat...
                  </TableCell>
                </TableRow>
              ) : paymentMethods.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Belum ada metode pembayaran tersedia
                  </TableCell>
                </TableRow>
              ) : (
                paymentMethods.map((method) => {
                  const isSelected = selectedMethodIds.has(method.id);
                  return (
                    <TableRow key={method.id} className={isSelected ? "bg-muted/50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleMethod(method.id, isSelected)}
                          disabled={saving}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{method.name}</TableCell>
                      <TableCell className="text-sm">{method.bank_code}</TableCell>
                      <TableCell className="text-sm">{method.account_name || "-"}</TableCell>
                      <TableCell className="text-sm font-mono">{method.account_number || "-"}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
