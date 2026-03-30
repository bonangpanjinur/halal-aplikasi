import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Info, Mail, Phone } from "lucide-react";
import { Link } from "react-router-dom";

interface BillingPlan {
  id: string;
  name: string;
  description: string;
  base_fee: number;
  fee_per_certificate: number;
  is_active: boolean;
}

interface PlatformInfo {
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  support_email: string;
  support_phone: string;
}

export default function Pricing() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo>({
    owner_name: "PT HalalTrack Indonesia",
    owner_email: "owner@halaltrack.id",
    owner_phone: "+62-21-XXXX-XXXX",
    support_email: "support@halaltrack.id",
    support_phone: "+62-21-XXXX-XXXX",
  });
  const [loading, setLoading] = useState(true);

  const formatRp = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [{ data: plansData }, { data: settingsData }] = await Promise.all([
          supabase
            .from("billing_plans")
            .select("*")
            .eq("is_active", true)
            .order("base_fee", { ascending: true }),
          supabase
            .from("app_settings")
            .select("key, value")
        ]);

        if (plansData) {
          setPlans(plansData as BillingPlan[]);
        }

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
          });
        }
      } catch (error) {
        console.error("Error fetching pricing data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Struktur Tarif Platform</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Transparansi harga adalah prioritas kami. Pelajari bagaimana kami menghitung tarif untuk setiap owner dan sertifikat halal.
          </p>
        </div>

        {/* Platform Owner Information */}
        <Card className="mb-12 border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600" /> Pemilik Platform
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-1">Nama Perusahaan</p>
                <p className="text-lg font-bold">{platformInfo.owner_name}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-1">Email</p>
                <a href={`mailto:${platformInfo.owner_email}`} className="text-blue-600 hover:underline font-medium">
                  {platformInfo.owner_email}
                </a>
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-1">Telepon</p>
                <p className="font-medium">{platformInfo.owner_phone}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Plans */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-center">Paket Langganan</h2>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Memuat paket...</p>
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Paket langganan sedang dipersiapkan.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <Card key={plan.id} className="relative overflow-hidden hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Base Fee */}
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-muted-foreground">Biaya Dasar (Bulanan)</p>
                      <p className="text-3xl font-bold text-primary">{formatRp(plan.base_fee)}</p>
                      <p className="text-xs text-muted-foreground">Biaya tetap setiap bulan</p>
                    </div>

                    {/* Per Certificate Fee */}
                    <div className="space-y-2 border-t pt-4">
                      <p className="text-sm font-semibold text-muted-foreground">Biaya per Sertifikat</p>
                      <p className="text-3xl font-bold text-green-600">{formatRp(plan.fee_per_certificate)}</p>
                      <p className="text-xs text-muted-foreground">Per sertifikat yang diselesaikan</p>
                    </div>

                    {/* Example Calculation */}
                    <div className="space-y-2 border-t pt-4 bg-muted/50 p-3 rounded">
                      <p className="text-sm font-semibold">Contoh Perhitungan (10 sertifikat)</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Biaya dasar</span>
                          <span className="font-mono">{formatRp(plan.base_fee)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">10 × {formatRp(plan.fee_per_certificate)}</span>
                          <span className="font-mono">{formatRp(plan.fee_per_certificate * 10)}</span>
                        </div>
                        <div className="border-t pt-1 flex justify-between font-bold">
                          <span>Total</span>
                          <span className="text-primary">{formatRp(plan.base_fee + plan.fee_per_certificate * 10)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* How It Works */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="text-2xl">Cara Kerja Sistem Tarif</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">1</div>
                  <div>
                    <h3 className="font-semibold">Pilih Paket</h3>
                    <p className="text-sm text-muted-foreground">Setiap owner memilih paket langganan yang sesuai dengan kebutuhan bisnis mereka.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">2</div>
                  <div>
                    <h3 className="font-semibold">Biaya Dasar Tetap</h3>
                    <p className="text-sm text-muted-foreground">Setiap bulan, biaya dasar paket ditagihkan otomatis kepada owner.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">3</div>
                  <div>
                    <h3 className="font-semibold">Hitung Sertifikat</h3>
                    <p className="text-sm text-muted-foreground">Sistem menghitung jumlah sertifikat yang berhasil diselesaikan dalam periode billing.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">4</div>
                  <div>
                    <h3 className="font-semibold">Biaya Usage</h3>
                    <p className="text-sm text-muted-foreground">Biaya per sertifikat dikalikan dengan jumlah sertifikat yang diselesaikan.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 md:col-span-2">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">5</div>
                  <div>
                    <h3 className="font-semibold">Invoice Diterbitkan</h3>
                    <p className="text-sm text-muted-foreground">Invoice bulanan diterbitkan dengan detail lengkap biaya dasar + biaya usage. Owner dapat membayar sesuai metode pembayaran yang tersedia.</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Formula */}
        <Card className="mb-12 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardHeader>
            <CardTitle>Formula Perhitungan Tagihan Bulanan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-white p-6 rounded-lg border-2 border-primary/20">
                <p className="text-center text-lg font-mono">
                  <span className="font-bold text-primary">Total Tagihan</span> = <span className="text-green-600 font-bold">Biaya Dasar</span> + (<span className="text-blue-600 font-bold">Biaya per Sertifikat</span> × <span className="text-orange-600 font-bold">Jumlah Sertifikat</span>)
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="font-semibold text-green-900">Biaya Dasar</p>
                  <p className="text-muted-foreground text-xs">Biaya tetap setiap bulan sesuai paket yang dipilih</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="font-semibold text-blue-900">Biaya per Sertifikat</p>
                  <p className="text-muted-foreground text-xs">Biaya variabel untuk setiap sertifikat yang diselesaikan</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="font-semibold text-orange-900">Jumlah Sertifikat</p>
                  <p className="text-muted-foreground text-xs">Total sertifikat dengan status "Selesai" dalam periode</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features & Benefits */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="text-2xl">Keunggulan Sistem Tarif Kami</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                "Transparansi penuh - tidak ada biaya tersembunyi",
                "Perhitungan otomatis berdasarkan volume sertifikat",
                "Fleksibilitas paket sesuai kebutuhan bisnis",
                "Invoice detail dengan breakdown per item",
                "Sistem pembayaran yang aman dan terpercaya",
                "Dukungan pelanggan siap membantu",
              ].map((feature, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="text-2xl">Pertanyaan Umum</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Kapan tagihan dihasilkan?</h3>
              <p className="text-sm text-muted-foreground">Invoice dihasilkan setiap akhir bulan (periode billing) berdasarkan jumlah sertifikat yang diselesaikan selama bulan tersebut.</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Bagaimana jika sertifikat dibatalkan?</h3>
              <p className="text-sm text-muted-foreground">Sertifikat yang dibatalkan atau dikembalikan tidak akan ditagihkan. Hanya sertifikat dengan status "Selesai" yang masuk dalam perhitungan tarif.</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Bisakah saya mengubah paket?</h3>
              <p className="text-sm text-muted-foreground">Ya, Anda dapat mengubah paket kapan saja. Perubahan akan berlaku untuk periode billing berikutnya.</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Metode pembayaran apa yang tersedia?</h3>
              <p className="text-sm text-muted-foreground">Platform mendukung berbagai metode pembayaran. Detail metode pembayaran tersedia di dashboard Anda.</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Apakah ada diskon untuk volume tinggi?</h3>
              <p className="text-sm text-muted-foreground">Hubungi tim kami untuk diskusi mengenai paket khusus atau negosiasi tarif untuk volume tinggi.</p>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="text-2xl">Hubungi Kami</CardTitle>
            <CardDescription>Memiliki pertanyaan tentang tarif atau ingin mendiskusikan paket khusus?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex gap-4">
                <Mail className="h-6 w-6 text-primary flex-shrink-0" />
                <div>
                  <p className="font-semibold">Email</p>
                  <a href={`mailto:${platformInfo.support_email}`} className="text-blue-600 hover:underline">
                    {platformInfo.support_email}
                  </a>
                </div>
              </div>
              <div className="flex gap-4">
                <Phone className="h-6 w-6 text-primary flex-shrink-0" />
                <div>
                  <p className="font-semibold">Telepon</p>
                  <p>{platformInfo.support_phone}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">Siap memulai?</p>
          <Link to="/login">
            <Button size="lg" className="gap-2">
              Masuk ke Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
