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
import { toast } from "@/hooks/use-toast";
import { CreditCard, Receipt, Package, Settings, Users, Save, Loader2, PlayCircle } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  description: string;
  base_price: number;
  fee_per_certificate: number;
}

interface OwnerSubscription {
  owner_id: string;
  owner_name: string | null;
  owner_email: string | null;
  plan_name: string | null;
  status: string | null;
  start_date: string | null;
}

export default function BillingManagement() {
  const { role } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<OwnerSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingPlan, setSavingPlan] = useState<string | null>(null);

  const formatRp = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  const fetchPlans = async () => {
    const { data } = await supabase.from("billing_plans" as any).select("*").order("base_price", { ascending: true });
    setPlans(data as any || []);
  };

  const fetchSubscriptions = async () => {
    // Get all owners
    const { data: owners } = await supabase
      .from("profiles")
      .select("id, full_name, email, user_roles!inner(role)")
      .eq("user_roles.role", "owner");
    
    // Get all subscriptions
    const { data: subs } = await supabase
      .from("subscriptions" as any)
      .select("*, billing_plans(name)");
    
    const subMap = new Map(subs?.map((s: any) => [s.owner_id, s]) || []);
    
    const combined: OwnerSubscription[] = (owners || []).map((o: any) => ({
      owner_id: o.id,
      owner_name: o.full_name,
      owner_email: o.email,
      plan_name: subMap.get(o.id)?.billing_plans?.name || "Starter (Default)",
      status: subMap.get(o.id)?.status || "active",
      start_date: subMap.get(o.id)?.start_date || null,
    }));
    
    setSubscriptions(combined);
  };

  useEffect(() => {
    if (role !== "super_admin") return;
    setLoading(true);
    Promise.all([fetchPlans(), fetchSubscriptions()]).finally(() => setLoading(false));
  }, [role]);

  const handleUpdatePlan = async (plan: Plan) => {
    setSavingPlan(plan.id);
    const { error } = await supabase
      .from("billing_plans" as any)
      .update({
        name: plan.name,
        description: plan.description,
        base_price: plan.base_price,
        fee_per_certificate: plan.fee_per_certificate,
        updated_at: new Date().toISOString()
      })
      .eq("id", plan.id);
    
    if (error) {
      toast({ title: "Gagal memperbarui paket", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Paket berhasil diperbarui" });
      fetchPlans();
    }
    setSavingPlan(null);
  };

  const handleGenerateInvoices = async () => {
    setGenerating(true);
    const period = new Date().toISOString().slice(0, 7); // YYYY-MM
    const { data, error } = await supabase.rpc("generate_monthly_invoices", { target_period: period });
    
    if (error) {
      toast({ title: "Gagal membuat invoice", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil membuat invoice", description: `${data} invoice telah dibuat/diperbarui untuk periode ${period}.` });
    }
    setGenerating(false);
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manajemen Penagihan Platform</h1>
        <Button onClick={handleGenerateInvoices} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          Generate Invoice Bulan Ini
        </Button>
      </div>

      <Tabs defaultValue="plans">
        <TabsList className="w-full">
          <TabsTrigger value="plans" className="flex-1 gap-2">
            <Package className="h-4 w-4" /> Daftar Paket
          </TabsTrigger>
          <TabsTrigger value="owners" className="flex-1 gap-2">
            <Users className="h-4 w-4" /> Langganan Owner
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex-1 gap-2">
            <Receipt className="h-4 w-4" /> Semua Invoice
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="mt-6">
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.id}>
                <CardHeader>
                  <CardTitle className="text-lg">Paket {plan.name}</CardTitle>
                  <CardDescription>ID: {plan.id.slice(0, 8)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nama Paket</Label>
                    <Input 
                      value={plan.name} 
                      onChange={(e) => setPlans(plans.map(p => p.id === plan.id ? { ...p, name: e.target.value } : p))} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Deskripsi</Label>
                    <Input 
                      value={plan.description} 
                      onChange={(e) => setPlans(plans.map(p => p.id === plan.id ? { ...p, description: e.target.value } : p))} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Biaya Dasar (Rp)</Label>
                    <Input 
                      type="number"
                      value={plan.base_price} 
                      onChange={(e) => setPlans(plans.map(p => p.id === plan.id ? { ...p, base_price: parseInt(e.target.value) || 0 } : p))} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Biaya per Sertifikat (Rp)</Label>
                    <Input 
                      type="number"
                      value={plan.fee_per_certificate} 
                      onChange={(e) => setPlans(plans.map(p => p.id === plan.id ? { ...p, fee_per_certificate: parseInt(e.target.value) || 0 } : p))} 
                    />
                  </div>
                  <Button 
                    className="w-full gap-2" 
                    onClick={() => handleUpdatePlan(plan)}
                    disabled={savingPlan === plan.id}
                  >
                    {savingPlan === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Simpan Perubahan
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="owners" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Langganan Owner</CardTitle>
              <CardDescription>Daftar semua owner dan paket yang mereka gunakan.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Owner</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Paket Aktif</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tanggal Mulai</TableHead>
                    <TableHead className="w-20">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Memuat...</TableCell></TableRow>
                  ) : subscriptions.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Belum ada data owner</TableCell></TableRow>
                  ) : subscriptions.map((sub) => (
                    <TableRow key={sub.owner_id}>
                      <TableCell className="font-medium">{sub.owner_name || "Tanpa Nama"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{sub.owner_email}</TableCell>
                      <TableCell><Badge variant="outline">{sub.plan_name}</Badge></TableCell>
                      <TableCell><Badge variant={sub.status === "active" ? "default" : "secondary"}>{sub.status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sub.start_date ? new Date(sub.start_date).toLocaleDateString("id-ID") : "Default"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">Ubah Paket</Button>
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
            <CardContent className="py-20 text-center">
              <Receipt className="mx-auto h-12 w-12 text-muted-foreground opacity-20" />
              <p className="mt-4 text-muted-foreground">Daftar semua invoice owner akan tampil di sini.</p>
              <Button variant="link" className="mt-2">Lihat di Database</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
