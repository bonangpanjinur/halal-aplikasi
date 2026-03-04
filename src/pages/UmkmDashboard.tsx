import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, CheckCircle2, ShieldCheck, FileCheck, Send, Award, AlertTriangle, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  belum_lengkap: { label: "Belum Lengkap", variant: "destructive", icon: Clock },
  siap_input: { label: "Siap Input", variant: "secondary", icon: CheckCircle2 },
  lengkap: { label: "Lengkap", variant: "secondary", icon: CheckCircle2 },
  ktp_terdaftar_nib: { label: "KTP Terdaftar NIB", variant: "destructive", icon: AlertTriangle },
  terverifikasi: { label: "Terverifikasi", variant: "default", icon: ShieldCheck },
  nib_selesai: { label: "NIB Selesai", variant: "secondary", icon: FileCheck },
  ktp_terdaftar_sertifikat: { label: "KTP Terdaftar Sertifikat", variant: "destructive", icon: AlertTriangle },
  pengajuan: { label: "Pengajuan", variant: "outline", icon: Send },
  sertifikat_selesai: { label: "Sertifikat Selesai", variant: "default", icon: Award },
};

interface UmkmEntry {
  id: string;
  nama: string | null;
  status: string;
  tracking_code: string | null;
  nib_url: string | null;
  sertifikat_url: string | null;
  created_at: string;
}

export default function UmkmDashboard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<UmkmEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchEntries = async () => {
      const { data } = await supabase
        .from("data_entries")
        .select("id, nama, status, tracking_code, nib_url, sertifikat_url, created_at")
        .eq("umkm_user_id", user.id)
        .order("created_at", { ascending: false });
      setEntries(data ?? []);
      setLoading(false);
    };
    fetchEntries();
  }, [user]);

  const getStatusConfig = (status: string) => STATUS_CONFIG[status] || { label: status, variant: "outline" as const, icon: Clock };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Memuat data...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Status UMKM Saya</h1>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Belum ada data terdaftar untuk akun Anda.</p>
            <p className="text-sm text-muted-foreground">Hubungi petugas lapangan untuk mendaftarkan data UMKM Anda.</p>
            <div className="mt-6">
              <Link to="/tracking">
                <Button variant="outline" className="gap-2">
                  <Search className="h-4 w-4" />
                  Cek Status dengan Kode Tracking
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => {
            const cfg = getStatusConfig(entry.status);
            const StatusIcon = cfg.icon;
            return (
              <Card key={entry.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{entry.nama || "Tanpa Nama"}</CardTitle>
                    <Badge variant={cfg.variant} className="gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {cfg.label}
                    </Badge>
                  </div>
                  {entry.tracking_code && (
                    <p className="text-xs text-muted-foreground font-mono">{entry.tracking_code}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">NIB:</span>{" "}
                      {entry.nib_url ? (
                        <a href={entry.nib_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Lihat NIB</a>
                      ) : (
                        <span className="text-muted-foreground">Belum ada</span>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sertifikat:</span>{" "}
                      {entry.sertifikat_url ? (
                        <a href={entry.sertifikat_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Lihat Sertifikat</a>
                      ) : (
                        <span className="text-muted-foreground">Belum ada</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Terdaftar: {new Date(entry.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
