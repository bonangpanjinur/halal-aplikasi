import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, FolderOpen, FileText, Link2, TrendingUp, Eye, Trophy, CalendarDays, CheckCircle2, Clock, AlertCircle, LayoutDashboard } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFieldAccess } from "@/hooks/useFieldAccess";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell,
  ResponsiveContainer, LabelList, CartesianGrid, Tooltip, Legend
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type DataEntry = Tables<"data_entries">;

const STATUS_LABELS: Record<string, string> = {
  belum_lengkap: "Belum Lengkap",
  siap_input: "Siap Input",
  lengkap: "Lengkap",
  ktp_terdaftar_nib: "KTP Terdaftar NIB",
  terverifikasi: "Terverifikasi",
  nib_selesai: "NIB Selesai",
  ktp_terdaftar_sertifikat: "KTP Terdaftar Sertifikat",
  pengajuan: "Pengajuan",
  sertifikat_selesai: "Sertifikat Selesai",
  revisi: "Revisi",
  selesai_revisi: "Selesai Revisi",
};

const STATUS_COLORS: Record<string, string> = {
  belum_lengkap: "#ef4444", // red-500
  siap_input: "#f59e0b", // amber-500
  lengkap: "#84cc16", // lime-500
  ktp_terdaftar_nib: "#f97316", // orange-500
  terverifikasi: "#22c55e", // green-500
  nib_selesai: "#3b82f6", // blue-500
  ktp_terdaftar_sertifikat: "#ea580c", // orange-600
  pengajuan: "#a855f7", // purple-500
  sertifikat_selesai: "#10b981", // emerald-500
  revisi: "#dc2626", // red-600
  selesai_revisi: "#d97706", // amber-600
};

const STATUS_BADGE_VARIANT: Record<string, string> = {
  belum_lengkap: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  siap_input: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
  lengkap: "bg-lime-100 text-lime-700 border-lime-200 dark:bg-lime-900/30 dark:text-lime-400 dark:border-lime-800",
  terverifikasi: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  nib_selesai: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  pengajuan: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
  sertifikat_selesai: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  revisi: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  selesai_revisi: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
};

type GroupStat = { name: string; count: number };
type StatusStat = { status: string; label: string; count: number; fill: string };
type AdminStat = { user_id: string; name: string; count: number };

const FIELD_LABELS: Record<string, string> = {
  nama: "Nama",
  alamat: "Alamat",
  nomor_hp: "No. HP",
  email_halal: "Email Halal",
  sandi_halal: "Sandi Halal",
  email_nib: "Email NIB",
  sandi_nib: "Sandi NIB",
  ktp: "KTP",
  nib: "NIB",
  foto_produk: "Foto Produk",
  foto_verifikasi: "Foto Verifikasi",
  sertifikat: "Sertifikat",
};

export default function Dashboard() {
  const { role, user } = useAuth();
  const { fields } = useFieldAccess();
  const [stats, setStats] = useState({ groups: 0, entries: 0, users: 0, links: 0, nib_selesai: 0, sertifikat_selesai: 0 });
  const [kpis, setKpis] = useState({ ttc: 0, conversion: 0, errorRate: 0 });
  const [statusData, setStatusData] = useState<StatusStat[]>([]);
  const [groupData, setGroupData] = useState<GroupStat[]>([]);
  const [recentEntries, setRecentEntries] = useState<DataEntry[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStat[]>([]);
  const [adminPeriod, setAdminPeriod] = useState("all");
  const [loading, setLoading] = useState(true);

  const visibleFields = fields.filter((f) => f.can_view).slice(0, 4); // Limit fields for mobile view

  useEffect(() => {
    const abortController = new AbortController();
    
    const fetchData = async () => {
      if (abortController.signal.aborted) return;
      
      setLoading(true);
      const isSuperAdmin = role === "super_admin";
      const isOwner = role === "owner";

      // 1. Fetch Basic Stats - Only fetch necessary fields
      let entriesQuery = supabase.from("data_entries").select("id, status", { count: "exact" });
      if (!isSuperAdmin && !isOwner && user) entriesQuery = entriesQuery.eq("created_by", user.id);
      
      const { data: allEntries, count: entriesCount } = await entriesQuery;
      
      if (abortController.signal.aborted) return;
      
      // Server-side aggregation would be better, but for now optimize client-side
      let nibCount = 0;
      let sertifikatCount = 0;
      if (allEntries) {
        nibCount = allEntries.filter(e => e.status === "nib_selesai").length;
        sertifikatCount = allEntries.filter(e => e.status === "sertifikat_selesai").length;
      }

      if (abortController.signal.aborted) return;
      
      const { count: groupsCount } = await supabase.from("groups").select("id", { count: "exact", head: true });
      
      let usersCount = 0;
      if (isSuperAdmin) {
        const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
        usersCount = count ?? 0;
      } else if (isOwner && user) {
        const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("owner_id", user.id);
        usersCount = count ?? 0;
      }

      if (abortController.signal.aborted) return;
      
      const { count: linksCount } = await supabase
        .from("shared_links")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user?.id ?? "");

      if (abortController.signal.aborted) return;
      
      setStats({
        groups: groupsCount ?? 0,
        entries: entriesCount ?? 0,
        users: usersCount,
        links: linksCount ?? 0,
        nib_selesai: nibCount,
        sertifikat_selesai: sertifikatCount,
      });

      if (abortController.signal.aborted) return;
      
      // 1.1 Calculate KPIs
      if (allEntries) {
        const completed = allEntries.filter(e => e.status === 'sertifikat_selesai');
        const total = allEntries.length;
        const revisions = allEntries.filter(e => e.status === 'revisi').length;
        
        // Time to Certificate (TTC) - placeholder for now
        const ttc = 24.5; // Target < 30 days
        const conversion = total > 0 ? (completed.length / total) * 100 : 0;
        const errorRate = total > 0 ? (revisions / total) * 100 : 0;

        setKpis({ ttc, conversion, errorRate });
      }

      // 2. Status Chart Data
      if (allEntries) {
        const counts: Record<string, number> = {};
        allEntries.forEach((e) => { counts[e.status] = (counts[e.status] || 0) + 1; });
        setStatusData(
          Object.entries(counts).map(([status, count]) => ({
            status,
            label: STATUS_LABELS[status] || status,
            count,
            fill: STATUS_COLORS[status] || "#94a3b8",
          }))
        );
      }

      if (abortController.signal.aborted) return;
      
      // 3. Group Chart Data
      let groupQuery = supabase.from("data_entries").select("group_id, groups(name)");
      if (!isSuperAdmin && !isOwner && user) groupQuery = groupQuery.eq("created_by", user.id);
      const { data: entryGroups } = await groupQuery;
      if (entryGroups) {
        const groupCounts: Record<string, { name: string; count: number }> = {};
        entryGroups.forEach((e: any) => {
          const gid = e.group_id;
          if (!groupCounts[gid]) groupCounts[gid] = { name: e.groups?.name || "Tanpa Group", count: 0 };
          groupCounts[gid].count++;
        });
        setGroupData(Object.values(groupCounts).sort((a, b) => b.count - a.count).slice(0, 5));
      }

      if (abortController.signal.aborted) return;
      
      // 4. Recent Entries
      let recentQuery = supabase
        .from("data_entries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (!isSuperAdmin && !isOwner && user) recentQuery = recentQuery.eq("created_by", user.id);
      const { data: recent } = await recentQuery;
      
      if (abortController.signal.aborted) return;
      
      setRecentEntries(recent ?? []);
      setLoading(false);
    };

    fetchData();
    
    // Cleanup function to abort requests if component unmounts
    return () => abortController.abort();
  }, [role, user]);

  // Admin performance stats
  useEffect(() => {
    if (role !== "super_admin") return;
    
    const abortController = new AbortController();
    
    const fetchAdminStats = async () => {
      if (abortController.signal.aborted) return;
      let query = supabase.from("data_entries").select("created_by");
      if (adminPeriod === "today") {
        query = query.gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
      } else if (adminPeriod === "week") {
        const d = new Date(); d.setDate(d.getDate() - 7);
        query = query.gte("created_at", d.toISOString());
      } else if (adminPeriod === "month") {
        const d = new Date(); d.setMonth(d.getMonth() - 1);
        query = query.gte("created_at", d.toISOString());
      }
      const { data: entries } = await query;
      if (!entries) return;
      const counts: Record<string, number> = {};
      entries.forEach((e: any) => { if (e.created_by) counts[e.created_by] = (counts[e.created_by] || 0) + 1; });
      const userIds = Object.keys(counts);
      if (userIds.length === 0) { setAdminStats([]); return; }
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email || "Unknown"]));
      const stats: AdminStat[] = userIds
        .map((uid) => ({ user_id: uid, name: profileMap.get(uid) || "Unknown", count: counts[uid] }))
        .sort((a, b) => b.count - a.count);
      setAdminStats(stats.slice(0, 5));
    };
    fetchAdminStats();
    
    return () => abortController.abort();
  }, [role, adminPeriod]);

  const getCellValue = (entry: DataEntry, fieldName: string) => {
    if (fieldName === "nama") return entry.nama;
    if (fieldName === "alamat") return entry.alamat;
    if (fieldName === "nomor_hp") return entry.nomor_hp;
    if (fieldName === "email_halal") return entry.email_halal;
    if (fieldName === "email_nib") return entry.email_nib;
    return "-";
  };

  const StatCard = ({ title, value, icon: Icon, description, colorClass, trend }: any) => (
    <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow duration-300">
      <div className={cn("h-1.5 w-full", colorClass)} />
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          </div>
          <div className={cn("p-3 rounded-xl bg-opacity-10", colorClass.replace("bg-", "bg-opacity-10 text-").replace("500", "600"))}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground font-medium">Memuat Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Selamat datang kembali, <span className="font-semibold text-foreground">{user?.email?.split("@")[0]}</span>. Berikut ringkasan aktivitas Anda.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-background border rounded-lg p-1.5 shadow-sm">
          <Badge variant="outline" className="px-3 py-1 border-none bg-primary/5 text-primary font-semibold">
            <CalendarDays className="mr-2 h-3.5 w-3.5" />
            {new Date().toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}
          </Badge>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Entri" 
          value={stats.entries} 
          icon={FileText} 
          description="Total data yang terdaftar"
          colorClass="bg-blue-500"
        />
        <StatCard 
          title="NIB Selesai" 
          value={stats.nib_selesai} 
          icon={CheckCircle2} 
          description={`${Math.round((stats.nib_selesai / (stats.entries || 1)) * 100)}% dari total entri`}
          colorClass="bg-emerald-500"
        />
        <StatCard 
          title="Sertifikat Selesai" 
          value={stats.sertifikat_selesai} 
          icon={Trophy} 
          description={`${Math.round((stats.sertifikat_selesai / (stats.entries || 1)) * 100)}% dari total entri`}
          colorClass="bg-amber-500"
        />
        <StatCard 
          title={role === "super_admin" ? "Total User" : "Share Link"} 
          value={role === "super_admin" ? stats.users : stats.links} 
          icon={role === "super_admin" ? Users : Link2} 
          description={role === "super_admin" ? "User aktif di sistem" : "Link aktif yang dibagikan"}
          colorClass="bg-purple-500"
        />
      </div>

      {/* Success Metrics (KPIs) */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-md overflow-hidden">
          <div className={cn("h-1.5 w-full", kpis.ttc <= 30 ? "bg-emerald-500" : "bg-destructive")} />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Time-to-Certificate (TTC)
              <Clock className="h-4 w-4 opacity-50" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.ttc} Hari</div>
            <p className="text-xs text-muted-foreground mt-1">Target: &lt; 30 Hari</p>
            <div className="mt-4 h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all", kpis.ttc <= 30 ? "bg-emerald-500" : "bg-destructive")} 
                style={{ width: `${Math.min((kpis.ttc / 30) * 100, 100)}%` }} 
              />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md overflow-hidden">
          <div className={cn("h-1.5 w-full", kpis.conversion >= 80 ? "bg-emerald-500" : "bg-amber-500")} />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Conversion Rate
              <CheckCircle2 className="h-4 w-4 opacity-50" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.conversion.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Target: &gt; 80%</p>
            <div className="mt-4 h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all", kpis.conversion >= 80 ? "bg-emerald-500" : "bg-amber-500")} 
                style={{ width: `${kpis.conversion}%` }} 
              />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md overflow-hidden">
          <div className={cn("h-1.5 w-full", kpis.errorRate <= 10 ? "bg-emerald-500" : "bg-destructive")} />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Error Rate (Revisi)
              <AlertCircle className="h-4 w-4 opacity-50" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.errorRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Target: &lt; 10%</p>
            <div className="mt-4 h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all", kpis.errorRate <= 10 ? "bg-emerald-500" : "bg-destructive")} 
                style={{ width: `${Math.min(kpis.errorRate * 5, 100)}%` }} 
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        {/* Status Distribution Chart */}
        <Card className="lg:col-span-4 border-none shadow-md">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Distribusi Status Entri
              </CardTitle>
              <CardDescription>Proporsi setiap status dalam sistem</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="label" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length && payload[0]) {
                        const item = payload[0];
                        const label = item?.payload?.label || item?.name || "Unknown";
                        return (
                          <div className="bg-white dark:bg-slate-900 p-3 border rounded-lg shadow-xl">
                            <p className="text-sm font-bold mb-1">{label}</p>
                            <p className="text-xs text-primary font-medium">{item.value} Entri</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={35}>
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                    <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Groups Chart */}
        <Card className="lg:col-span-3 border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              Top Group Halal
            </CardTitle>
            <CardDescription>Group dengan entri terbanyak</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {groupData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <FolderOpen className="h-10 w-10 mb-2 opacity-20" />
                  <p className="text-sm">Belum ada data group</p>
                </div>
              ) : (
                groupData.map((group, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate max-w-[200px]">{group.name}</span>
                      <span className="text-muted-foreground font-semibold">{group.count} Entri</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-500" 
                        style={{ width: `${(group.count / (groupData[0]?.count || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        {/* Recent Entries Table */}
        <Card className={cn("border-none shadow-md", role === "super_admin" ? "lg:col-span-4" : "lg:col-span-7")}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Entri Terbaru
              </CardTitle>
              <CardDescription>Aktivitas data terakhir</CardDescription>
            </div>
            <Badge variant="secondary" className="font-normal">5 Terakhir</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead className="font-bold">Nama UMKM</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="font-bold text-right">Tanggal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-10 text-muted-foreground">
                        Belum ada data entri
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentEntries.map((entry) => (
                      <TableRow key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{entry.nama}</span>
                            <span className="text-[10px] text-muted-foreground">{entry.nomor_hp}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("font-medium border shadow-none", STATUS_BADGE_VARIANT[entry.status] || "bg-slate-100 text-slate-700")}>
                            {STATUS_LABELS[entry.status] || entry.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {new Date(entry.created_at).toLocaleDateString("id-ID", { day: 'numeric', month: 'short' })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Admin Performance (Super Admin Only) */}
        {role === "super_admin" && (
          <Card className="lg:col-span-3 border-none shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  Performa Admin
                </CardTitle>
              </div>
              <Select value={adminPeriod} onValueChange={setAdminPeriod}>
                <SelectTrigger className="w-[110px] h-8 text-xs">
                  <SelectValue placeholder="Periode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="today">Hari Ini</SelectItem>
                  <SelectItem value="week">7 Hari</SelectItem>
                  <SelectItem value="month">30 Hari</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {adminStats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <Users className="h-10 w-10 mb-2 opacity-20" />
                    <p className="text-sm">Tidak ada data performa</p>
                  </div>
                ) : (
                  adminStats.map((admin, index) => (
                    <div key={admin.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                        index === 0 ? "bg-amber-100 text-amber-700" : 
                        index === 1 ? "bg-slate-200 text-slate-700" : 
                        index === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"
                      )}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{admin.name}</p>
                        <p className="text-xs text-muted-foreground">{admin.count} Entri Berhasil</p>
                      </div>
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                        {Math.round((admin.count / (stats.entries || 1)) * 100)}%
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
