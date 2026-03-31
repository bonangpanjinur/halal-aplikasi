# Product Requirements Document (PRD): HalalTrack

**Nama Proyek**: HalalTrack  
**Versi**: 1.5  
**Tanggal**: 31 Maret 2026  
**Status**: Fully Implemented

---

## 1. Ringkasan Proyek (Project Overview)
HalalTrack adalah platform Software-as-a-Service (SaaS) yang dirancang untuk mendigitalisasi dan menyederhanakan proses pelacakan sertifikasi halal. Platform ini menghubungkan UMKM, petugas lapangan, verifikator, dan pengelola sertifikasi dalam satu ekosistem yang transparan dan efisien.

---

## 2. Tujuan Produk (Product Goals)
*   **Transparansi** [✅ SELESAI]: Memberikan visibilitas penuh kepada UMKM mengenai status sertifikasi mereka.
*   **Efisiensi Operasional** [✅ SELESAI]: Mempercepat alur kerja verifikasi melalui pembagian peran yang jelas.
*   **Skalabilitas** [✅ SELESAI]: Mendukung model bisnis multi-owner dengan isolasi data tenant.
*   **Akurasi Data** [✅ SELESAI]: Memastikan data valid melalui verifikasi berjenjang.

---

## 3. Target Pengguna (User Personas)
| Persona | Status | Deskripsi |
| :--- | :---: | :--- |
| **Super Admin** | ✅ | Pengelola platform pusat, manajemen owner, penagihan global. |
| **Owner** | ✅ | Pengelola lembaga pendamping, manajemen tim dan komisi. |
| **Admin / Admin Input** | ✅ | Staf operasional, input data UMKM harian. |
| **Petugas Lapangan** | ✅ | Verifikator lapangan, update status dan unggah bukti foto. |
| **Verifikator NIB** | ✅ | Validasi dokumen legalitas (NIB). |
| **UMKM** | ✅ | Pemilik usaha, pelacakan status mandiri. |

---

## 4. Metrik Keberhasilan (Success Metrics/KPIs)
*   **Time-to-Certificate (TTC)** [✅ TERIMPLEMENTASI]: Rata-rata waktu dari `belum_lengkap` ke `sertifikat_selesai`. Target: < 30 hari.
*   **Conversion Rate Pengajuan** [✅ TERIMPLEMENTASI]: Persentase UMKM yang berhasil menyelesaikan sertifikasi. Target: > 80%.
*   **Error Rate Revisi** [✅ TERIMPLEMENTASI]: Frekuensi pengajuan yang masuk ke status `revisi`. Target: < 10%.
*   **Adopsi Fitur** [✅ TERIMPLEMENTASI]: Penggunaan fitur manajemen komisi dan metode pembayaran oleh Owner.
*   **Kepuasan Pengguna (UMKM)** [✅ TERIMPLEMENTASI]: Diukur melalui rating aplikasi.

---

## 5. Fitur Utama (Core Features)
### 5.1 Manajemen Multi-Tenancy (Multi-Owner)
*   **Isolasi Data** [✅ SELESAI]: RLS di database memastikan data antar owner tidak tercampur.
*   **Manajemen Pengguna** [✅ SELESAI]: Owner dapat mengelola tim di bawah naungan mereka.
*   **Branding Kustom** [⏳ ROADMAP]: Penyesuaian logo dan warna per tenant.

### 5.2 Pelacakan Sertifikasi Real-time
*   **Dashboard Status** [✅ SELESAI]: Visualisasi tahapan pengajuan di dashboard.
*   **Sistem Workflow Berjenjang** [✅ SELESAI]: Alur otomatis dari input hingga sertifikat terbit.
*   **Audit Log** [✅ SELESAI]: Pencatatan setiap perubahan status untuk akuntabilitas.

### 5.3 Sistem Billing & Invoicing
*   **Model Hybrid** [✅ SELESAI]: Biaya dasar + biaya per sertifikat.
*   **Otomasi Invoice** [✅ SELESAI]: Super Admin men-generate invoice bulanan untuk Owner.
*   **Estimasi Tagihan** [✅ SELESAI]: Visibilitas biaya berjalan secara real-time.

### 5.4 Manajemen Komisi
*   **Pengaturan Tarif** [✅ SELESAI]: Owner menentukan besaran komisi per peran.
*   **Laporan Komisi** [✅ SELESAI]: Rekapitulasi komisi berdasarkan performa tim.

### 5.5 Manajemen Metode Pembayaran
*   **Global Methods** [✅ SELESAI]: Super Admin mengelola daftar bank/e-wallet platform.
*   **Preferred Methods** [✅ SELESAI]: Owner memilih metode pembayaran untuk tim mereka.

---

## 6. Fitur Dinamis & Keamanan (Fase 3 & 4)
*   **Konfigurasi Workflow Dinamis** [✅ TERIMPLEMENTASI]: Definisi tahapan kustom per kategori.
*   **Template Dokumen & Formulir** [✅ TERIMPLEMENTASI]: Formulir input data yang dapat disesuaikan.
*   **Sistem Notifikasi** [✅ SELESAI]: Notifikasi berbasis peran dan aktivitas relevan.
*   **Audit Trail Komprehensif** [✅ SELESAI]: Log akses data sensitif (KTP/NIB).
*   **PWA (Progressive Web App)** [✅ SELESAI]: Mendukung instalasi di Android/iOS untuk akses mobile optimal.

---

## 7. Persyaratan Teknis (Technical Requirements)
*   **Frontend**: React.js, TypeScript, Vite, Tailwind CSS, shadcn-ui.
*   **Backend**: Supabase (PostgreSQL) dengan Row Level Security (RLS).
*   **PWA**: Terintegrasi via `vite-plugin-pwa`, mendukung instalasi layar utama (A2HS).
*   **Error Management**: Global Error Boundary dengan logging terpusat ke Supabase.

---

**Dokumentasi ini diperbarui berdasarkan status implementasi terbaru per 31 Maret 2026.**

---

### Referensi
[1] [bonangpanjinur/halal-aplikasi](https://github.com/bonangpanjinur/halal-aplikasi) - Repositori GitHub proyek HalalTrack.
