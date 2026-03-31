import { useState, useEffect } from "react";
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
import { Loader2, Plus, Receipt, Download, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface OwnerRate {
  owner_id: string;
  owner_name: string;
  owner_email: string;
  fee_per_certificate: number;
}

interface Invoice {
  id: string;
  owner_id: string;
  period: string;
  total_certificates: number;
  fee_per_certificate: number;
  total_amount: number;
  status: "unpaid" | "paid";
  created_at: string;
}

const BillingManagement = () => {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [owners, setOwners] = useState<OwnerRate[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  
  // New Rate Dialog State
  const [isRateDialogOpen, setIsRateDialogOpen] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState("");
  const [fee, setFee] = useState("");

  // New Invoice Dialog State
  const [isInvDialogOpen, setIsInvDialogOpen] = useState(false);
  const [invOwner, setInvOwner] = useState("");
  const [invPeriod, setInvPeriod] = useState(format(new Date(), "yyyy-MM"));

  useEffect(() => {
    if (user && role === "super_admin") {
      fetchData();
    }
  }, [user, role]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Get owner user IDs
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "owner");
      
      if (rolesError) throw rolesError;

      let ownerList: OwnerRate[] = [];
      if (rolesData && rolesData.length > 0) {
        const ownerIds = rolesData.map(r => r.user_id);
        
        // 2. Get profiles for these IDs
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ownerIds);
        
        if (profilesError) throw profilesError;

        // 3. Get billing rates
        const { data: rates, error: ratesError } = await supabase
          .from("owner_billing_rates")
          .select("*");
        
        if (ratesError) throw ratesError;

        const rateMap = new Map((rates ?? []).map((r: any) => [r.owner_id, r.fee_per_certificate]));

        ownerList = (profilesData ?? []).map((p: any) => ({
          owner_id: p.id,
          owner_name: p.full_name || "Unknown",
          owner_email: p.email || "No Email",
          fee_per_certificate: rateMap.get(p.id) ?? 0,
        }));
      }
      setOwners(ownerList);

      // 4. Get all invoices
      const { data: invData, error: invError } = await supabase
        .from("owner_invoices")
        .select("*")
        .order("period", { ascending: false });
      
      if (invError) throw invError;

      setInvoices(invData || []);
    } catch (error: any) {
      console.error("Error fetching billing data:", error);
      toast({
        title: "Error",
        description: "Gagal mengambil data penagihan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRate = async () => {
    if (!selectedOwner || !fee) return;

    try {
      const { error } = await supabase
        .from("owner_billing_rates")
        .upsert({
          owner_id: selectedOwner,
          fee_per_certificate: parseInt(fee),
          updated_at: new Date().toISOString(),
          updated_by: user?.id
        });

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Tarif berhasil disimpan",
      });
      setIsRateDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleGenerateInvoice = async () => {
    if (!invOwner || !invPeriod) return;

    try {
      // 1. Get total certificates for this owner in this period
      // A certificate is "done" when status is 'sertifikat_selesai'
      const { count, error: countError } = await supabase
        .from("data_entries")
        .select("*", { count: "exact", head: true })
        .eq("status", "sertifikat_selesai")
        .filter("updated_at", "gte", `${invPeriod}-01T00:00:00Z`)
        .filter("updated_at", "lt", format(new Date(new Date(invPeriod + "-01").setMonth(new Date(invPeriod + "-01").getMonth() + 1)), "yyyy-MM-dd") + "T00:00:00Z");

      if (countError) throw countError;

      const owner = owners.find(o => o.owner_id === invOwner);
      if (!owner) throw new Error("Owner tidak ditemukan");

      const totalCertificates = count || 0;
      const totalAmount = totalCertificates * owner.fee_per_certificate;

      const { error: invError } = await supabase
        .from("owner_invoices")
        .insert({
          owner_id: invOwner,
          period: invPeriod,
          total_certificates: totalCertificates,
          fee_per_certificate: owner.fee_per_certificate,
          total_amount: totalAmount,
          status: "unpaid"
        });

      if (invError) throw invError;

      toast({
        title: "Berhasil",
        description: "Invoice berhasil dibuat",
      });
      setIsInvDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "paid" ? "unpaid" : "paid";
      const { error } = await supabase
        .from("owner_invoices")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    try {
      const { error } = await supabase
        .from("owner_invoices")
        .delete()
        .eq("id", id);

      if (error) throw error;
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (role !== "super_admin") {
    return <div className="p-8 text-center">Hanya Super Admin yang dapat mengakses halaman ini.</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Manajemen Penagihan Owner</h1>
        <div className="flex gap-2">
          <Dialog open={isRateDialogOpen} onOpenChange={setIsRateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Atur Tarif
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Atur Tarif per Sertifikat</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Pilih Owner</Label>
                  <Select value={selectedOwner} onValueChange={setSelectedOwner}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {owners.map((o) => (
                        <SelectItem key={o.owner_id} value={o.owner_id}>
                          {o.owner_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tarif (Rp)</Label>
                  <Input 
                    type="number" 
                    value={fee} 
                    onChange={(e) => setFee(e.target.value)}
                    placeholder="Contoh: 50000"
                  />
                </div>
                <Button className="w-full" onClick={handleSaveRate}>Simpan</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isInvDialogOpen} onOpenChange={setIsInvDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Receipt className="h-4 w-4 mr-2" />
                Buat Invoice
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Invoice Bulanan</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Pilih Owner</Label>
                  <Select value={invOwner} onValueChange={setInvOwner}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {owners.map((o) => (
                        <SelectItem key={o.owner_id} value={o.owner_id}>
                          {o.owner_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Periode (YYYY-MM)</Label>
                  <Input 
                    type="month" 
                    value={invPeriod} 
                    onChange={(e) => setInvPeriod(e.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={handleGenerateInvoice}>Generate</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-8">
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Daftar Tarif Owner</h2>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Owner</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tarif per Sertifikat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : owners.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8">Tidak ada data owner.</TableCell>
                  </TableRow>
                ) : (
                  owners.map((o) => (
                    <TableRow key={o.owner_id}>
                      <TableCell className="font-medium">{o.owner_name}</TableCell>
                      <TableCell>{o.owner_email}</TableCell>
                      <TableCell>Rp {o.fee_per_certificate.toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Riwayat Invoice</h2>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periode</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Total Sertifikat</TableHead>
                  <TableHead>Total Tagihan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">Belum ada invoice.</TableCell>
                  </TableRow>
                ) : (
                  invoices.map((inv) => {
                    const owner = owners.find(o => o.owner_id === inv.owner_id);
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.period}</TableCell>
                        <TableCell>{owner?.owner_name || "Unknown"}</TableCell>
                        <TableCell>{inv.total_certificates}</TableCell>
                        <TableCell>Rp {inv.total_amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Button 
                            variant={inv.status === "paid" ? "secondary" : "outline"}
                            size="sm"
                            className={inv.status === "paid" ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"}
                            onClick={() => handleUpdateStatus(inv.id, inv.status)}
                          >
                            {inv.status === "paid" ? "Lunas" : "Belum Bayar"}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon">
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive"
                              onClick={() => handleDeleteInvoice(inv.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default BillingManagement;
