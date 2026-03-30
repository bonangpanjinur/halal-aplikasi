import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Receipt, TrendingUp, ChevronDown, ChevronUp, AlertCircle, Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Invoice {
  id: string;
  period: string;
  status: string;
  total_amount: number;
  issued_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

interface InvoiceItem {
  id: string;
  invoice_id: string;
  entry_id: string | null;
  amount: number;
  description: string | null;
}

interface PlatformInfo {
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  support_email: string;
  support_phone: string;
  pricing_description: string;
}

export default function OwnerBilling() {
  const { user, role } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<Record<string, InvoiceItem[]>>({});
  const [billingRate, setBillingRate] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo>({
    owner_name: "PT HalalTrack Indonesia",
    owner_email: "owner@halaltrack.id",
    owner_phone: "+62-21-XXXX-XXXX",
    support_email: "support@halaltrack.id",
    support_phone: "+62-21-XXXX-XXXX",
    pricing_description: "Tarif platform dihitung berdasarkan jumlah sertifikat halal yang berhasil diselesaikan."
  });

  const formatRp = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  useEffect(() => {
    if (!user || role !== "owner") return;

    const fetchData = async () => {
      setLoading(true);

      try {
        // Fetch billing rate
        const [{ data: rateData }, { data: invData }, { data: settingsData }] = await Promise.all([
          supabase
            .from("owner_billing_rates")
            .select("fee_per_certificate")
            .eq("owner_id", user.id)
            .maybeSingle(),
          supabase
            .from("owner_invoices")
            .select("*")
            .eq("owner_id", user.id)
            .order("period", { ascending: false }),
          supabase
            .from("app_settings")
            .select("key, value")
        ]);

        setBillingRate(rateData?.fee_per_certificate ?? 0);
        setInvoices((invData as Invoice[]) || []);

        // Parse platform info from settings
        if (settingsData) {
          const settings = settingsData.reduce((acc: any, row: any) => {
            acc[row.key] = row.value;
            return acc;
          }, {});

          setPlatformInfo({
            owner_name: settings.platform_owner_name || "PT HalalTrack Indonesia",
            owner_email: settings.platform_owner_email || "owner@halaltrack.id",
            owner_phone: settings.platform_owner_phone || "+62-21-XXXX-XXXX",
            support_email: settings.platform_support_email || "support@halaltrack.id",
            support_phone: settings.platform_support_phone || "+62-21-XXXX-XXXX",
            pricing_description: settings.pricing_description || "Tarif platform dihitung berdasarkan jumlah sertifikat halal yang berhasil diselesaikan."
          });
        }
      } catch (error) {
        console.error("Error fetching billing data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, role]);

  const toggleInvoiceItems = async (invoiceId: string) => {
    if (expandedInvoice === invoiceId) {
      setExpandedInvoice(null);
      return;
    }
    setExpandedInvoice(invoiceId);

    if (!invoiceItems[invoiceId]) {
      const { data } = await supabase
        .from("owner_invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: false });
      setInvoiceItems((prev) => ({ ...prev, [invoiceId]: (data as InvoiceItem[]) || [] }));
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-600">Lunas</Badge>;
      case "issued":
        return <Badge variant="destructive">Belum Bayar</Badge>;
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  const currentPeriod = new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const currentInvoice = invoices.find((i) => i.period === new Date().toISOString().slice(0, 7));

  if (role !== "owner") {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Hanya Owner yang dapat mengakses halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tagihan Platform</h1>
        <p className="text-muted-foreground mt-2">Kelola dan pantau tagihan bulanan Anda dari platform {platformInfo.owner_name}</p>
      </div>

      {/* Platform Owner Information Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="h-5 w-5 text-blue-600" /> Informasi Pemilik Platform
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Nama Pemilik Platform</p>
              <p className="text-base font-medium">{platformInfo.owner_name}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Email Pemilik</p>
              <p className="text-base font-medium text-blue-600 hover:underline cursor-pointer">
                <a href={`mailto:${platformInfo.owner_email}`}>{platformInfo.owner_email}</a>
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Telepon Pemilik</p>
              <p className="text-base font-medium">{platformInfo.owner_phone}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Email Dukungan</p>
              <p className="text-base font-medium text-blue-600 hover:underline cursor-pointer">
                <a href={`mailto:${platformInfo.support_email}`}>{platformInfo.support_email}</a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Explanation Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Cara Perhitungan Tarif:</strong> {platformInfo.pricing_description}
        </AlertDescription>
      </Alert>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" /> Estimasi Bulan Ini
            </CardTitle>
            <CardDescription>{currentPeriod}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Biaya per Sertifikat</span>
                <span className="font-semibold text-base">{formatRp(billingRate)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between text-sm">
                <span className="text-muted-foreground">Total Sertifikat Selesai</span>
                <span className="font-semibold text-base">
                  {currentInvoice ? Math.round(currentInvoice.total_amount / (billingRate || 1)) : 0} sertifikat
                </span>
              </div>
            </div>
            <div className="rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 p-4 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-muted-foreground">Total Estimasi Tagihan</span>
                <span className="text-primary text-2xl font-bold">{formatRp(currentInvoice?.total_amount || 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ringkasan Invoice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground font-semibold">Total Invoice</p>
                <p className="text-2xl font-bold">{invoices.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-50">
                <p className="text-xs text-muted-foreground font-semibold">Lunas</p>
                <p className="text-2xl font-bold text-green-600">{invoices.filter((i) => i.status === "paid").length}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50">
                <p className="text-xs text-muted-foreground font-semibold">Belum Bayar</p>
                <p className="text-2xl font-bold text-red-600">{invoices.filter((i) => i.status === "issued").length}</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-50">
                <p className="text-xs text-muted-foreground font-semibold">Draft</p>
                <p className="text-2xl font-bold text-yellow-600">{invoices.filter((i) => i.status === "draft").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5 text-primary" /> Riwayat Invoice
          </CardTitle>
          <CardDescription>Daftar lengkap semua invoice yang telah diterbitkan</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total Tagihan</TableHead>
                <TableHead>Tanggal Terbit</TableHead>
                <TableHead>Tanggal Bayar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Memuat...</TableCell>
                </TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Belum ada invoice</TableCell>
                </TableRow>
              ) : (
                invoices.map((inv) => (
                  <Collapsible key={inv.id} open={expandedInvoice === inv.id} asChild>
                    <>
                      <CollapsibleTrigger asChild>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleInvoiceItems(inv.id)}
                        >
                          <TableCell>
                            {expandedInvoice === inv.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{inv.period}</TableCell>
                          <TableCell>{statusBadge(inv.status)}</TableCell>
                          <TableCell className="font-bold">{formatRp(inv.total_amount)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString("id-ID") : "-"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("id-ID") : "-"}
                          </TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={6} className="p-0">
                            <div className="px-6 py-4">
                              <p className="mb-3 text-xs font-semibold text-muted-foreground uppercase">Detail Item Invoice</p>
                              {!invoiceItems[inv.id] ? (
                                <p className="text-sm text-muted-foreground">Memuat...</p>
                              ) : invoiceItems[inv.id].length === 0 ? (
                                <p className="text-sm text-muted-foreground">Tidak ada item</p>
                              ) : (
                                <div className="space-y-2">
                                  {invoiceItems[inv.id].map((item) => (
                                    <div key={item.id} className="flex justify-between items-center p-2 bg-white/50 rounded text-sm">
                                      <span className="text-muted-foreground">{item.description || "Item Sertifikat"}</span>
                                      <span className="font-mono font-semibold">{formatRp(item.amount)}</span>
                                    </div>
                                  ))}
                                  <div className="border-t pt-2 mt-2 flex justify-between items-center font-semibold">
                                    <span>Total</span>
                                    <span className="text-primary">{formatRp(inv.total_amount)}</span>
                                  </div>
                                </div>
                              )}
                              {inv.notes && (
                                <p className="mt-3 text-xs text-muted-foreground bg-yellow-50/50 p-2 rounded">
                                  <strong>Catatan:</strong> {inv.notes}
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Support Information */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader>
          <CardTitle className="text-base">Butuh Bantuan?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>Hubungi tim dukungan kami untuk pertanyaan mengenai tagihan atau tarif platform:</p>
          <ul className="space-y-1 ml-4">
            <li>📧 Email: <a href={`mailto:${platformInfo.support_email}`} className="text-blue-600 hover:underline">{platformInfo.support_email}</a></li>
            <li>📞 Telepon: {platformInfo.support_phone}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
