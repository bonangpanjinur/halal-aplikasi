import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Search, CheckCircle2, Clock, Download, Copy, ArrowLeft, FileText, Send, Award, FileCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface TrackingData {
  tracking_code: string;
  nama: string | null;
  status: string;
  sertifikat_url: string | null;
  created_at: string;
}

const STEPS = [
  {
    key: "belum_lengkap",
    label: "Data Terisi",
    description: "Data UMKM telah berhasil diinput ke sistem",
    icon: FileText,
  },
  {
    key: "nib_selesai",
    label: "NIB Selesai",
    description: "Nomor Induk Berusaha (NIB) telah diupload dan diverifikasi",
    icon: FileCheck,
  },
  {
    key: "pengajuan",
    label: "Pengajuan Sertifikat",
    description: "Dokumen sertifikasi halal sedang diajukan ke lembaga terkait",
    icon: Send,
  },
  {
    key: "sertifikat_selesai",
    label: "Sertifikat Selesai",
    description: "Sertifikat halal telah terbit dan siap didownload",
    icon: Award,
  },
];

const STATUS_ORDER: Record<string, number> = {
  belum_lengkap: 0,
  lengkap: 0,
  terverifikasi: 0,
  nib_selesai: 1,
  pengajuan: 2,
  sertifikat_selesai: 3,
};

const STATUS_LABEL: Record<string, string> = {
  belum_lengkap: "Menunggu Kelengkapan Data",
  lengkap: "Data Lengkap",
  terverifikasi: "Data Terverifikasi",
  nib_selesai: "NIB Selesai",
  pengajuan: "Dalam Pengajuan",
  sertifikat_selesai: "Sertifikat Selesai",
};

export default function TrackingPage() {
  const { code: urlCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [inputCode, setInputCode] = useState(urlCode ?? "");
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (codeToSearch?: string) => {
    const code = (codeToSearch ?? inputCode).trim().toUpperCase();
    if (!code) return;
    setLoading(true);
    setSearched(true);

    const { data, error } = await supabase
      .from("tracking_view" as any)
      .select("*")
      .eq("tracking_code", code)
      .single();

    if (error || !data) {
      setTracking(null);
    } else {
      setTracking(data as unknown as TrackingData);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (urlCode) handleSearch(urlCode);
  }, [urlCode]);

  const copyCode = () => {
    if (tracking?.tracking_code) {
      navigator.clipboard.writeText(tracking.tracking_code);
      toast({ title: "Kode tracking disalin!" });
    }
  };

  const currentStep = tracking ? (STATUS_ORDER[tracking.status] ?? 0) : -1;
  const progressPercent = tracking ? Math.round(((currentStep + 1) / STEPS.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 px-4 py-8">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-md">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Tracking Sertifikat Halal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Masukkan kode tracking untuk melihat status proses sertifikasi Anda
          </p>
        </div>

        {/* Search */}
        <Card className="mb-6 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <Input
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="HT-XXXXXX"
                className="font-mono text-lg tracking-wider"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                maxLength={9}
              />
              <Button onClick={() => handleSearch()} disabled={loading}>
                <Search className="mr-2 h-4 w-4" />
                {loading ? "..." : "Cari"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-muted-foreground text-sm">Mencari data tracking...</p>
          </div>
        )}

        {/* Not Found */}
        {!loading && searched && !tracking && (
          <Card className="shadow-sm">
            <CardContent className="py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <Search className="h-5 w-5 text-destructive" />
              </div>
              <p className="text-destructive font-semibold">Kode tracking tidak ditemukan</p>
              <p className="text-sm text-muted-foreground mt-1">
                Pastikan kode yang Anda masukkan benar (format: HT-XXXXXX)
              </p>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {!loading && tracking && (
          <div className="space-y-4">
            {/* Summary Card */}
            <Card className="shadow-sm overflow-hidden">
              <div className="h-1.5 bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-700 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">{tracking.nama || "UMKM"}</CardTitle>
                    <CardDescription className="mt-1">
                      Terdaftar {new Date(tracking.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 font-mono text-xs shrink-0" onClick={copyCode}>
                    <Copy className="h-3 w-3" />
                    {tracking.tracking_code}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    Status: {STATUS_LABEL[tracking.status] || tracking.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{progressPercent}% selesai</span>
                </div>
              </CardContent>
            </Card>

            {/* Progress Steps */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Progress Sertifikasi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-0">
                  {STEPS.map((step, idx) => {
                    const isComplete = currentStep >= idx;
                    const isCurrent = currentStep === idx;
                    const StepIcon = step.icon;
                    return (
                      <div key={step.key} className="flex gap-4">
                        {/* Timeline */}
                        <div className="flex flex-col items-center">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                              isComplete
                                ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                : isCurrent
                                ? "border-primary/50 bg-primary/10 text-primary"
                                : "border-muted-foreground/20 bg-muted text-muted-foreground/40"
                            }`}
                          >
                            {isComplete ? (
                              <CheckCircle2 className="h-5 w-5" />
                            ) : (
                              <StepIcon className="h-4 w-4" />
                            )}
                          </div>
                          {idx < STEPS.length - 1 && (
                            <div
                              className={`w-0.5 flex-1 min-h-[40px] transition-colors duration-500 ${
                                isComplete ? "bg-primary" : "bg-muted-foreground/15"
                              }`}
                            />
                          )}
                        </div>
                        {/* Content */}
                        <div className={`pb-8 pt-1.5 ${idx === STEPS.length - 1 ? "pb-0" : ""}`}>
                          <p
                            className={`font-semibold text-sm leading-tight ${
                              isComplete
                                ? "text-foreground"
                                : isCurrent
                                ? "text-foreground/80"
                                : "text-muted-foreground"
                            }`}
                          >
                            {step.label}
                            {isCurrent && (
                              <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">
                                Saat ini
                              </Badge>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            {step.description}
                          </p>
                          {isComplete && (
                            <p className="text-[11px] text-primary mt-1 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Selesai
                            </p>
                          )}
                          {/* Download Sertifikat */}
                          {step.key === "sertifikat_selesai" && isComplete && tracking.sertifikat_url && (
                            <a href={tracking.sertifikat_url} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" className="mt-3 gap-2 shadow-sm">
                                <Download className="h-4 w-4" />
                                Download Sertifikat Halal
                              </Button>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Info */}
            <Card className="shadow-sm bg-muted/50 border-dashed">
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  Status diperbarui secara otomatis oleh sistem. Jika ada pertanyaan, hubungi petugas lapangan yang mendaftarkan data Anda.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <Button variant="ghost" size="sm" onClick={() => navigate("/login")} className="text-muted-foreground">
            <ArrowLeft className="mr-2 h-3 w-3" />
            Ke Halaman Login
          </Button>
        </div>
      </div>
    </div>
  );
}
