import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, Receipt, Package, TrendingUp, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Invoice {
  id: string;
  period: string;
  status: string;
  total_amount: number;
  base_amount: number;
  usage_amount: number;
  issued_at: string | null;
  paid_at: string | null;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  base_price: number;
  fee_per_certificate: number;
}

export default function OwnerBilling() {
  const { user, role } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);

  const formatRp = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  useEffect(() => {
    if (!user || role !== "owner") return;

    const fetchBillingData = async () => {
      setLoading(true);
      
      // Fetch subscription & plan
      const { data: subData } = await supabase
        .from("subscriptions" as any)
        .select("*, billing_plans(*)")
        .eq("owner_id", user.id)
        .single();
      
      if (subData) {
        setCurrentPlan((subData as any).billing_plans);
      }

      // Fetch invoices
      const { data: invData } = await supabase
        .from("owner_invoices")
        .select("*")
        .eq("owner_id", user.id)
        .order("period", { ascending: false });
      
      setInvoices(invData as any || []);
      setLoading(false);
    };

    fetchBillingData();
  }, [user, role]);

  if (role !== "owner") {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Hanya Owner yang dapat mengakses halaman penagihan ini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Penagihan & Paket</h1>
        <Button variant="outline" className="gap-2">
          <CreditCard className="h-4 w-4" /> Metode Pembayaran
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Current Plan */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-primary" /> Paket Saat Ini
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentPlan ? (
              <>
                <div>
                  <h3 className="text-2xl font-bold text-primary">{currentPlan.name}</h3>
                  <p className="text-sm text-muted-foreground">{currentPlan.description}</p>
                </div>
                <div className="space-y-1 border-t pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Biaya Dasar:</span>
                    <span className="font-medium">{formatRp(currentPlan.base_price)}/bln</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Per Sertifikat:</span>
                    <span className="font-medium">{formatRp(currentPlan.fee_per_certificate)}</span>
                  </div>
                </div>
                <Button className="w-full" variant="secondary">Upgrade Paket</Button>
              </>
            ) : (
              <div className="py-4 text-center">
                <p className="text-sm text-muted-foreground">Belum berlangganan paket apapun.</p>
                <Button className="mt-4 w-full">Pilih Paket</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage Stats */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" /> Estimasi Tagihan Berjalan
            </CardTitle>
            <CardDescription>Bulan {new Date().toLocaleDateString("id-ID", { month: 'long', year: 'numeric' })}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-8 py-2">
              <div>
                <p className="text-sm text-muted-foreground">Biaya Berlangganan</p>
                <p className="text-2xl font-bold">{formatRp(currentPlan?.base_price || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Biaya Sertifikat (Usage)</p>
                <p className="text-2xl font-bold">{formatRp(invoices[0]?.usage_amount || 0)}</p>
              </div>
            </div>
            <div className="mt-6 rounded-lg bg-muted/50 p-4">
              <div className="flex items-center justify-between font-bold">
                <span>Total Estimasi</span>
                <span className="text-primary text-xl">
                  {formatRp((currentPlan?.base_price || 0) + (invoices[0]?.usage_amount || 0))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5 text-primary" /> Riwayat Invoice
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Periode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Biaya Dasar</TableHead>
                <TableHead>Biaya Usage</TableHead>
                <TableHead>Total Tagihan</TableHead>
                <TableHead>Tanggal Bayar</TableHead>
                <TableHead className="w-20">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Memuat...</TableCell></TableRow>
              ) : invoices.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Belum ada invoice</TableCell></TableRow>
              ) : invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.period}</TableCell>
                  <TableCell>
                    <Badge variant={inv.status === "paid" ? "default" : inv.status === "draft" ? "secondary" : "destructive"}>
                      {inv.status === "paid" ? "Lunas" : inv.status === "draft" ? "Draft" : "Belum Bayar"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{formatRp(inv.base_amount || 0)}</TableCell>
                  <TableCell className="font-mono text-sm">{formatRp(inv.usage_amount || 0)}</TableCell>
                  <TableCell className="font-bold">{formatRp(inv.total_amount)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("id-ID") : "-"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" title="Lihat Detail">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
