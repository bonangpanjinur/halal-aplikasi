import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { CreditCard, Receipt, Users, Save, Loader2, Edit, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface OwnerRate {
  owner_id: string;
  owner_name: string | null;
  owner_email: string | null;
  fee_per_certificate: number;
}

interface Invoice {
  id: string;
  owner_id: string;
  period: string;
  status: string;
  total_amount: number;
  created_at: string;
  issued_at: string | null;
  paid_at: string | null;
  notes: string | null;
  owner_name?: string;
  owner_email?: string;
}

interface InvoiceItem {
  id: string;
  amount: number;
  description: string | null;
  entry_id: string | null;
  created_at: string;
}

export default function BillingManagement() {
  const { role } = useAuth();
  const [owners, setOwners] = useState<OwnerRate[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<Record<string, InvoiceItem[]>>({});
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Edit rate dialog
  const [editTarget, setEditTarget] = useState<OwnerRate | null>(null);
  const [editRate, setEditRate] = useState(0);
  const [savingRate, setSavingRate] = useState(false);

  const formatRp = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  const fetchData = async () => {
    setLoading(true);

    // Get all owners via user_roles join
    const { data: ownerProfiles } = await supabase
      .from("user_roles")
      .select("user_id, profiles!inner(id, full_name, email)")
      .eq("role", "owner") as any;

    // Get all billing rates
    const { data: rates } = await supabase.from("owner_billing_rates").select("*");
    const rateMap = new Map((rates ?? []).map((r: any) => [r.owner_id, r.fee_per_certificate]));

    const ownerList: OwnerRate[] = (ownerProfiles ?? []).map((o: any) => ({
      owner_id: o.profiles.id,
      owner_name: o.profiles.full_name,
      owner_email: o.profiles.email,
      fee_per_certificate: rateMap.get(o.profiles.id) ?? 0,
    }));
    setOwners(ownerList);

    // Get all invoices
    const { data: invData } = await supabase
      .from("owner_invoices")
      .select("*")
      .order("period", { ascending: false });

    const profileMap = new Map(ownerList.map((o) => [o.owner_id, { name: o.owner_name, email: o.owner_email }]));
    setInvoices(
      (invData ?? []).map((inv: any) => ({
        ...inv,
        owner_name: profileMap.get(inv.owner_id)?.name,
        owner_email: profileMap.get(inv.owner_id)?.email,
      }))
    );

    setLoading(false);
  };

  useEffect(() => {
    if (role !== "super_admin") return;
    fetchData();
  }, [role]);

  const handleSaveRate = async () => {
    if (!editTarget) return;
    setSavingRate(true);
    const { error } = await supabase
      .from("owner_billing_rates")
      .upsert(
        { owner_id: editTarget.owner_id, fee_per_certificate: editRate, updated_at: new Date().toISOString() },
        { onConflict: "owner_id" }
      );
    setSavingRate(false);
    if (error) {
      toast({ title: "Gagal menyimpan tarif", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Tarif berhasil disimpan" });
      setEditTarget(null);
      fetchData();
    }
  };

  const handleChangeStatus = async (invoice: Invoice, newStatus: string) => {
    const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === "issued") updates.issued_at = new Date().toISOString();
    if (newStatus === "paid") updates.paid_at = new Date().toISOString();

    const { error } = await supabase.from("owner_invoices").update(updates).eq("id", invoice.id);
    if (error) {
      toast({ title: "Gagal mengubah status", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Status invoice diubah ke ${newStatus}` });
      fetchData();
    }
  };

  const toggleInvoiceItems = async (invoiceId: string) => {
    const next = new Set(expandedInvoices);
    if (next.has(invoiceId)) {
      next.delete(invoiceId);
      setExpandedInvoices(next);
      return;
    }
    if (!invoiceItems[invoiceId]) {
      const { data } = await supabase
        .from("owner_invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: false });
      setInvoiceItems((prev) => ({ ...prev, [invoiceId]: data ?? [] }));
    }
    next.add(invoiceId);
    setExpandedInvoices(next);
  };

  const statusColor = (s: string) => {
    if (s === "paid") return "default";
    if (s === "issued") return "secondary";
    return "outline";
  };

  const statusLabel = (s: string) => {
    if (s === "paid") return "Lunas";
    if (s === "issued") return "Terkirim";
    return "Draft";
  };

  const nextStatus = (s: string) => {
    if (s === "draft") return "issued";
    if (s === "issued") return "paid";
    return null;
  };

  if (role !== "super_admin") {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Hanya Super Admin yang dapat mengakses manajemen penagihan ini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Manajemen Penagihan Platform</h1>

      <Tabs defaultValue="owners">
        <TabsList className="w-full">
          <TabsTrigger value="owners" className="flex-1 gap-2">
            <Users className="h-4 w-4" /> Tarif per Owner
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex-1 gap-2">
            <Receipt className="h-4 w-4" /> Semua Invoice
          </TabsTrigger>
        </TabsList>

        <TabsContent value="owners" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tarif Platform per Owner</CardTitle>
              <CardDescription>Atur biaya per sertifikat selesai untuk setiap owner.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Owner</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tarif / Sertifikat</TableHead>
                    <TableHead className="w-20">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Memuat...</TableCell></TableRow>
                  ) : owners.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Belum ada owner</TableCell></TableRow>
                  ) : owners.map((o) => (
                    <TableRow key={o.owner_id}>
                      <TableCell className="font-medium">{o.owner_name || "Tanpa Nama"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{o.owner_email}</TableCell>
                      <TableCell className="font-mono">{formatRp(o.fee_per_certificate)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => { setEditTarget(o); setEditRate(o.fee_per_certificate); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Semua Invoice Owner</CardTitle>
              <CardDescription>Kelola status invoice: draft → terkirim → lunas</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Owner</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-32">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Memuat...</TableCell></TableRow>
                  ) : invoices.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Belum ada invoice</TableCell></TableRow>
                  ) : invoices.map((inv) => (
                    <Collapsible key={inv.id} open={expandedInvoices.has(inv.id)} onOpenChange={() => toggleInvoiceItems(inv.id)} asChild>
                      <>
                        <CollapsibleTrigger asChild>
                          <TableRow className="cursor-pointer hover:bg-muted/50">
                            <TableCell className="font-medium">{inv.owner_name || inv.owner_id.slice(0, 8)}</TableCell>
                            <TableCell>{inv.period}</TableCell>
                            <TableCell className="font-mono">{formatRp(inv.total_amount)}</TableCell>
                            <TableCell><Badge variant={statusColor(inv.status)}>{statusLabel(inv.status)}</Badge></TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {nextStatus(inv.status) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); handleChangeStatus(inv, nextStatus(inv.status)!); }}
                                  >
                                    {nextStatus(inv.status) === "issued" ? "Kirim" : "Lunasi"}
                                  </Button>
                                )}
                                {expandedInvoices.has(inv.id) ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleTrigger>
                        <CollapsibleContent asChild>
                          <TableRow>
                            <TableCell colSpan={5} className="bg-muted/30 p-4">
                              <p className="text-xs font-medium text-muted-foreground mb-2">Detail Item Invoice</p>
                              {(invoiceItems[inv.id] ?? []).length === 0 ? (
                                <p className="text-sm text-muted-foreground">Tidak ada item</p>
                              ) : (
                                <div className="space-y-1">
                                  {(invoiceItems[inv.id] ?? []).map((item) => (
                                    <div key={item.id} className="flex justify-between text-sm">
                                      <span>{item.description || "Item"}</span>
                                      <span className="font-mono">{formatRp(item.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Rate Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah Tarif Platform</DialogTitle>
            <DialogDescription>
              Atur biaya per sertifikat selesai untuk {editTarget?.owner_name || editTarget?.owner_email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Biaya per Sertifikat (Rp)</Label>
            <Input type="number" value={editRate} onChange={(e) => setEditRate(parseInt(e.target.value) || 0)} min={0} step={1000} className="font-mono" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Batal</Button>
            <Button onClick={handleSaveRate} disabled={savingRate} className="gap-2">
              {savingRate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
