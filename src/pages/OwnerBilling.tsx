import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Receipt, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

export default function OwnerBilling() {
  const { user, role } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<Record<string, InvoiceItem[]>>({});
  const [billingRate, setBillingRate] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const formatRp = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  useEffect(() => {
    if (!user || role !== "owner") return;

    const fetchData = async () => {
      setLoading(true);

      const [{ data: rateData }, { data: invData }] = await Promise.all([
        supabase
          .from("owner_billing_rates")
          .select("fee_per_certificate")
          .eq("owner_id", user.id)
          .single(),
        supabase
          .from("owner_invoices")
          .select("*")
          .eq("owner_id", user.id)
          .order("period", { ascending: false }),
      ]);

      setBillingRate(rateData?.fee_per_certificate ?? 0);
      setInvoices((invData as Invoice[]) || []);
      setLoading(false);
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
      <h1 className="text-2xl font-bold">Tagihan Platform</h1>

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
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tarif per Sertifikat</span>
              <span className="font-medium">{formatRp(billingRate)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Sertifikat Bulan Ini</span>
              <span className="font-medium">
                {currentInvoice ? Math.round(currentInvoice.total_amount / (billingRate || 1)) : 0}
              </span>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-center justify-between font-bold">
                <span>Total Estimasi</span>
                <span className="text-primary text-xl">{formatRp(currentInvoice?.total_amount || 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ringkasan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Invoice</span>
              <span className="font-bold">{invoices.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Lunas</span>
              <span className="font-bold text-green-600">{invoices.filter((i) => i.status === "paid").length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Belum Bayar</span>
              <span className="font-bold text-destructive">{invoices.filter((i) => i.status === "issued").length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Draft</span>
              <span className="font-bold">{invoices.filter((i) => i.status === "draft").length}</span>
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
                          className="cursor-pointer"
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
                            <div className="px-6 py-3">
                              <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Detail Item</p>
                              {!invoiceItems[inv.id] ? (
                                <p className="text-sm text-muted-foreground">Memuat...</p>
                              ) : invoiceItems[inv.id].length === 0 ? (
                                <p className="text-sm text-muted-foreground">Tidak ada item</p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Deskripsi</TableHead>
                                      <TableHead className="text-right">Jumlah</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {invoiceItems[inv.id].map((item) => (
                                      <TableRow key={item.id}>
                                        <TableCell className="text-sm">{item.description || "-"}</TableCell>
                                        <TableCell className="text-right font-mono text-sm">{formatRp(item.amount)}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                              {inv.notes && (
                                <p className="mt-2 text-xs text-muted-foreground">Catatan: {inv.notes}</p>
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
    </div>
  );
}
