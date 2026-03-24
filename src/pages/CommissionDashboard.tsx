import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Wallet, Clock, CheckCircle2, Users, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface OwnerCommission {
  id: string;
  full_name: string;
  email: string;
  platform_fee_per_entry: number;
  total_entries: number;
  total_commission: number;
  paid_commission: number;
  pending_commission: number;
  details?: CommissionDetail[];
}

interface CommissionDetail {
  id: string;
  entry_name: string;
  amount: number;
  status: string;
  created_at: string;
}

export default function CommissionDashboard() {
  const { role } = useAuth();
  const [owners, setOwners] = useState<OwnerCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedOwner, setExpandedOwner] = useState<string | null>(null);

  const fetchCommissions = async () => {
    setLoading(true);
    // 1. Get all owners
    const { data: rolesData } = await supabase.from("user_roles").select("user_id").eq("role", "owner");
    const ownerIds = rolesData?.map(r => r.user_id) || [];
    
    if (ownerIds.length === 0) {
      setOwners([]);
      setLoading(false);
      return;
    }

    // 2. Get owner profiles
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, email, platform_fee_per_entry")
      .in("id", ownerIds);

    // 3. Get all entries for these owners (via groups)
    const { data: groupsData } = await supabase.from("groups").select("id, owner_id").in("owner_id", ownerIds);
    const groupOwnerMap = new Map(groupsData?.map(g => [g.id, g.owner_id]));
    const groupIds = groupsData?.map(g => g.id) || [];

    const { data: entriesData } = await supabase
      .from("data_entries")
      .select("id, group_id, nama, status, created_at")
      .in("group_id", groupIds);

    // 4. Calculate commissions
    const ownerMap = new Map<string, OwnerCommission>();
    profilesData?.forEach(p => {
      ownerMap.set(p.id, {
        id: p.id,
        full_name: p.full_name || "Tanpa Nama",
        email: p.email || "-",
        platform_fee_per_entry: p.platform_fee_per_entry || 0,
        total_entries: 0,
        total_commission: 0,
        paid_commission: 0,
        pending_commission: 0,
        details: []
      });
    });

    entriesData?.forEach(e => {
      const ownerId = groupOwnerMap.get(e.group_id);
      if (ownerId && ownerMap.has(ownerId)) {
        const owner = ownerMap.get(ownerId)!;
        const fee = owner.platform_fee_per_entry;
        owner.total_entries += 1;
        owner.total_commission += fee;
        
        // For now, let's assume all entries that are 'sertifikat_selesai' are 'paid'
        // and others are 'pending' for the platform fee calculation
        if (e.status === 'sertifikat_selesai') {
          owner.paid_commission += fee;
        } else {
          owner.pending_commission += fee;
        }

        owner.details?.push({
          id: e.id,
          entry_name: e.nama || "Tanpa Nama",
          amount: fee,
          status: e.status,
          created_at: e.created_at
        });
      }
    });

    setOwners(Array.from(ownerMap.values()));
    setLoading(false);
  };

  useEffect(() => {
    if (role === "super_admin") fetchCommissions();
  }, [role]);

  const filteredOwners = owners.filter(o => 
    o.full_name.toLowerCase().includes(search.toLowerCase()) || 
    o.email.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    totalNeedToPay: owners.reduce((acc, o) => acc + o.pending_commission, 0),
    totalPaid: owners.reduce((acc, o) => acc + o.paid_commission, 0),
    totalOwners: owners.length,
    totalEntries: owners.reduce((acc, o) => acc + o.total_entries, 0),
  };

  if (role !== "super_admin") {
    return <div className="p-8 text-center">Hanya Super Admin yang dapat mengakses halaman ini.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Dashboard Komisi Platform</h1>
        <p className="text-muted-foreground">Pantau pendapatan platform dari setiap owner UMKM.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Perlu Dibayar</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rp {stats.totalNeedToPay.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Dari data yang belum selesai</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sudah Dibayar</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rp {stats.totalPaid.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Dari data sertifikat selesai</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jumlah Owner</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOwners}</div>
            <p className="text-xs text-muted-foreground">Owner aktif di platform</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Data Masuk</CardTitle>
            <Wallet className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEntries.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total semua entri data</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Daftar Komisi per Owner</CardTitle>
              <CardDescription>Klik owner untuk melihat rincian data</CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari owner atau email..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Tarif / Entry</TableHead>
                <TableHead>Total Data</TableHead>
                <TableHead>Pending</TableHead>
                <TableHead>Selesai (Paid)</TableHead>
                <TableHead className="text-right">Total Komisi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Memuat data...</TableCell></TableRow>
              ) : filteredOwners.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Tidak ada data owner.</TableCell></TableRow>
              ) : filteredOwners.map(o => (
                <>
                  <TableRow 
                    key={o.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setExpandedOwner(expandedOwner === o.id ? null : o.id)}
                  >
                    <TableCell>
                      {expandedOwner === o.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{o.full_name}</span>
                        <span className="text-xs text-muted-foreground">{o.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>Rp {o.platform_fee_per_entry.toLocaleString()}</TableCell>
                    <TableCell>{o.total_entries}</TableCell>
                    <TableCell className="text-orange-600 font-medium">Rp {o.pending_commission.toLocaleString()}</TableCell>
                    <TableCell className="text-green-600 font-medium">Rp {o.paid_commission.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-bold">Rp {o.total_commission.toLocaleString()}</TableCell>
                  </TableRow>
                  {expandedOwner === o.id && (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={7} className="p-4">
                        <div className="rounded-lg border bg-background p-4">
                          <h4 className="font-semibold mb-3 text-sm">Rincian Data: {o.full_name}</h4>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Nama Data</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                                <TableHead className="text-xs">Tanggal</TableHead>
                                <TableHead className="text-xs text-right">Komisi</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {o.details?.slice(0, 10).map(d => (
                                <TableRow key={d.id}>
                                  <TableCell className="text-xs">{d.entry_name}</TableCell>
                                  <TableCell className="text-xs">
                                    <Badge variant="outline" className="text-[10px] uppercase">{d.status.replace('_', ' ')}</Badge>
                                  </TableCell>
                                  <TableCell className="text-xs">{new Date(d.created_at).toLocaleDateString('id-ID')}</TableCell>
                                  <TableCell className="text-xs text-right">Rp {d.amount.toLocaleString()}</TableCell>
                                </TableRow>
                              ))}
                              {o.details && o.details.length > 10 && (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-2">
                                    Menampilkan 10 dari {o.details.length} data.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
