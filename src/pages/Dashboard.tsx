import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FolderOpen, FileText, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";

const STATUS_LABELS: Record<string, string> = {
  belum_lengkap: "Belum Lengkap",
  lengkap: "Lengkap",
  terverifikasi: "Terverifikasi",
};

const STATUS_COLORS: Record<string, string> = {
  belum_lengkap: "hsl(0 84% 60%)",
  lengkap: "hsl(45 93% 47%)",
  terverifikasi: "hsl(142 71% 45%)",
};

const pieChartConfig: ChartConfig = {
  belum_lengkap: { label: "Belum Lengkap", color: STATUS_COLORS.belum_lengkap },
  lengkap: { label: "Lengkap", color: STATUS_COLORS.lengkap },
  terverifikasi: { label: "Terverifikasi", color: STATUS_COLORS.terverifikasi },
};

const barChartConfig: ChartConfig = {
  count: { label: "Jumlah Entri", color: "hsl(var(--primary))" },
};

type GroupStat = { name: string; count: number };
type StatusStat = { status: string; label: string; count: number; fill: string };

export default function Dashboard() {
  const { role, user } = useAuth();
  const [stats, setStats] = useState({ groups: 0, entries: 0, users: 0, links: 0 });
  const [statusData, setStatusData] = useState<StatusStat[]>([]);
  const [groupData, setGroupData] = useState<GroupStat[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const [groupsRes, entriesRes] = await Promise.all([
        supabase.from("groups").select("id", { count: "exact", head: true }),
        supabase.from("data_entries").select("id", { count: "exact", head: true }),
      ]);

      let usersCount = 0;
      let linksCount = 0;

      if (role === "super_admin") {
        const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
        usersCount = count ?? 0;
      }

      if (role === "lapangan") {
        const { count } = await supabase.from("shared_links").select("id", { count: "exact", head: true }).eq("user_id", user?.id ?? "");
        linksCount = count ?? 0;
      }

      setStats({
        groups: groupsRes.count ?? 0,
        entries: entriesRes.count ?? 0,
        users: usersCount,
        links: linksCount,
      });
    };

    const fetchChartData = async () => {
      // Status distribution
      const { data: entries } = await supabase.from("data_entries").select("status");
      if (entries) {
        const counts: Record<string, number> = { belum_lengkap: 0, lengkap: 0, terverifikasi: 0 };
        entries.forEach((e) => { counts[e.status] = (counts[e.status] || 0) + 1; });
        setStatusData(
          Object.entries(counts).map(([status, count]) => ({
            status,
            label: STATUS_LABELS[status] || status,
            count,
            fill: STATUS_COLORS[status] || "hsl(var(--primary))",
          }))
        );
      }

      // Per-group counts
      const { data: entryGroups } = await supabase.from("data_entries").select("group_id, groups(name)");
      if (entryGroups) {
        const groupCounts: Record<string, { name: string; count: number }> = {};
        entryGroups.forEach((e: any) => {
          const gid = e.group_id;
          if (!groupCounts[gid]) {
            groupCounts[gid] = { name: e.groups?.name || "Unknown", count: 0 };
          }
          groupCounts[gid].count++;
        });
        setGroupData(Object.values(groupCounts).sort((a, b) => b.count - a.count).slice(0, 10));
      }
    };

    fetchStats();
    fetchChartData();
  }, [role, user]);

  const cards = [
    { label: "Group Halal", value: stats.groups, icon: FolderOpen, show: true },
    { label: "Data Entri", value: stats.entries, icon: FileText, show: true },
    { label: "Total User", value: stats.users, icon: Users, show: role === "super_admin" },
    { label: "Link Aktif", value: stats.links, icon: Link2, show: role === "lapangan" },
  ];

  const totalEntries = statusData.reduce((s, d) => s + d.count, 0);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {cards.filter(c => c.show).map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribusi Status Entri</CardTitle>
          </CardHeader>
          <CardContent>
            {totalEntries === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Belum ada data</p>
            ) : (
              <ChartContainer config={pieChartConfig} className="mx-auto aspect-square max-h-[280px]">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                  <Pie
                    data={statusData}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={100}
                    strokeWidth={2}
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.status} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}
            {totalEntries > 0 && (
              <div className="flex flex-wrap justify-center gap-4 mt-2">
                {statusData.map((s) => (
                  <div key={s.status} className="flex items-center gap-1.5 text-sm">
                    <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: s.fill }} />
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="font-medium">{s.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Group Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jumlah Entri per Group</CardTitle>
          </CardHeader>
          <CardContent>
            {groupData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Belum ada data</p>
            ) : (
              <ChartContainer config={barChartConfig} className="max-h-[320px]">
                <BarChart data={groupData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
