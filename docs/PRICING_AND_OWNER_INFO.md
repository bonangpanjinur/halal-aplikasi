# Dokumentasi Tarif Platform dan Informasi Pemilik

## Ringkasan Eksekutif

Dokumen ini menjelaskan struktur tarif platform Halal Aplikasi, cara perhitungan biaya, dan informasi pemilik platform yang transparan. Sistem dirancang untuk memberikan fleksibilitas kepada setiap owner dengan model SaaS multi-tenant yang jelas dan terukur.

## 1. Informasi Pemilik Platform

### Data Pemilik
Informasi pemilik platform disimpan dalam tabel `app_settings` dengan key-value pairs:

| Key | Deskripsi | Contoh |
|-----|-----------|--------|
| `platform_owner_name` | Nama resmi perusahaan pemilik platform | PT HalalTrack Indonesia |
| `platform_owner_email` | Email kontak pemilik platform | owner@halaltrack.id |
| `platform_owner_phone` | Nomor telepon pemilik platform | +62-21-XXXX-XXXX |
| `platform_owner_address` | Alamat kantor pemilik platform | Jakarta, Indonesia |
| `platform_support_email` | Email tim dukungan pelanggan | support@halaltrack.id |
| `platform_support_phone` | Nomor telepon tim dukungan | +62-21-XXXX-XXXX |

### Akses Informasi Pemilik

**Super Admin:**
- Dapat melihat dan mengedit semua informasi pemilik platform di halaman **Settings > Info Pemilik**
- Perubahan akan langsung ditampilkan di halaman publik Pricing dan dashboard Owner

**Owner:**
- Dapat melihat informasi pemilik platform di halaman **Paket & Billing**
- Informasi ditampilkan untuk referensi kontak dan pertanyaan billing

**Public:**
- Informasi pemilik platform ditampilkan di halaman publik `/pricing`
- Memudahkan calon pengguna untuk menghubungi pemilik platform

## 2. Struktur Tarif Platform

### Model Pricing: Hybrid (Base Fee + Usage-Based)

Platform menggunakan model pricing hybrid yang terdiri dari:

1. **Biaya Dasar (Base Fee)**: Biaya tetap bulanan sesuai paket yang dipilih
2. **Biaya per Sertifikat (Usage Fee)**: Biaya variabel berdasarkan jumlah sertifikat yang diselesaikan

### Paket Langganan

Platform menyediakan tiga paket standar:

| Paket | Biaya Dasar | Biaya per Sertifikat | Target Pengguna |
|-------|-------------|----------------------|-----------------|
| **Starter** | Rp 0 | Rp 25.000 | UMKM kecil, volume rendah |
| **Professional** | Rp 500.000 | Rp 15.000 | Bisnis menengah, volume sedang |
| **Enterprise** | Rp 2.000.000 | Rp 5.000 | Korporasi besar, volume tinggi |

### Formula Perhitungan

```
Total Tagihan Bulanan = Biaya Dasar + (Biaya per Sertifikat × Jumlah Sertifikat Selesai)
```

#### Contoh Perhitungan

**Skenario 1: Owner dengan Paket Starter (10 sertifikat)**
```
= Rp 0 + (Rp 25.000 × 10)
= Rp 250.000
```

**Skenario 2: Owner dengan Paket Professional (20 sertifikat)**
```
= Rp 500.000 + (Rp 15.000 × 20)
= Rp 500.000 + Rp 300.000
= Rp 800.000
```

**Skenario 3: Owner dengan Paket Enterprise (50 sertifikat)**
```
= Rp 2.000.000 + (Rp 5.000 × 50)
= Rp 2.000.000 + Rp 250.000
= Rp 2.250.000
```

## 3. Proses Billing

### Periode Billing
- **Siklus**: Bulanan (1 bulan kalender)
- **Tanggal Penerbitan**: Akhir bulan atau awal bulan berikutnya
- **Jatuh Tempo**: Sesuai kesepakatan (default 14 hari)

### Alur Proses Billing

```
1. Akhir Bulan
   ↓
2. Sistem Hitung Sertifikat Selesai
   ↓
3. Hitung Biaya = Base Fee + (Fee per Cert × Jumlah Sertifikat)
   ↓
4. Generate Invoice (Status: Draft)
   ↓
5. Super Admin Review & Approve
   ↓
6. Invoice Diterbitkan (Status: Issued)
   ↓
7. Owner Menerima Notifikasi
   ↓
8. Owner Melakukan Pembayaran
   ↓
9. Invoice Ditandai Lunas (Status: Paid)
```

### Status Invoice

| Status | Deskripsi |
|--------|-----------|
| **Draft** | Invoice baru dibuat, belum diterbitkan, dapat diedit |
| **Issued** | Invoice sudah diterbitkan, menunggu pembayaran |
| **Paid** | Invoice sudah dibayar, transaksi selesai |

## 4. Manajemen Tarif per Owner

### Fitur Super Admin

Super Admin dapat:
- Melihat daftar semua owner dengan tarif saat ini
- Mengubah tarif per owner (override tarif paket default)
- Melihat riwayat perubahan tarif
- Membuat paket khusus untuk owner tertentu

### Penyimpanan Data Tarif

Tarif per owner disimpan di tabel `owner_billing_rates`:

```sql
CREATE TABLE owner_billing_rates (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES profiles(id),
  fee_per_certificate NUMERIC NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Akses Tarif

**Super Admin:**
- Halaman: **Penagihan > Atur Tarif per Owner**
- Dapat melihat dan mengedit tarif untuk setiap owner

**Owner:**
- Halaman: **Paket & Billing > Estimasi Bulan Ini**
- Dapat melihat tarif mereka sendiri (read-only)

## 5. Transparansi dan Komunikasi

### Halaman Publik Pricing (`/pricing`)

Halaman publik yang menampilkan:
- ✅ Informasi pemilik platform (nama, email, telepon)
- ✅ Daftar paket dengan harga detail
- ✅ Formula perhitungan tarif
- ✅ Contoh perhitungan untuk berbagai skenario
- ✅ Cara kerja sistem billing (5 langkah)
- ✅ FAQ tentang tarif dan pembayaran
- ✅ Informasi kontak dukungan

### Dashboard Owner (`/billing`)

Owner dapat melihat:
- ✅ Informasi pemilik platform (nama, email, telepon)
- ✅ Tarif per sertifikat mereka
- ✅ Estimasi tagihan bulan ini
- ✅ Riwayat invoice dengan detail
- ✅ Status pembayaran
- ✅ Informasi kontak dukungan

### Dashboard Super Admin (`/billing-management`)

Super Admin dapat:
- ✅ Melihat daftar semua owner dengan tarif mereka
- ✅ Mengedit tarif per owner
- ✅ Melihat invoice yang sudah diterbitkan
- ✅ Mengubah status invoice
- ✅ Melihat riwayat pembayaran

## 6. Keamanan dan Validasi

### Row Level Security (RLS)

Kebijakan RLS diterapkan untuk memastikan:

```sql
-- Owner hanya bisa melihat invoice mereka sendiri
SELECT * FROM owner_invoices 
WHERE owner_id = auth.uid();

-- Super Admin bisa melihat semua invoice
SELECT * FROM owner_invoices 
WHERE has_role(auth.uid(), 'super_admin');
```

### Validasi Data

- ✅ Tarif tidak boleh negatif
- ✅ Jumlah sertifikat dihitung otomatis dari status
- ✅ Invoice tidak bisa diedit setelah status "Issued"
- ✅ Perubahan tarif hanya berlaku untuk periode berikutnya

## 7. Integrasi Sistem

### Database Tables

| Tabel | Fungsi |
|-------|--------|
| `app_settings` | Menyimpan informasi pemilik dan konfigurasi platform |
| `billing_plans` | Definisi paket (Starter, Professional, Enterprise) |
| `subscriptions` | Hubungan owner dengan paket yang dipilih |
| `owner_billing_rates` | Tarif per sertifikat untuk setiap owner |
| `owner_invoices` | Header invoice bulanan |
| `owner_invoice_items` | Detail item dalam invoice |
| `owner_payment_methods` | Metode pembayaran yang tersedia untuk owner |

### API Endpoints

```
GET  /api/app_settings              - Ambil informasi pemilik
GET  /api/billing_plans             - Ambil daftar paket
GET  /api/owner_billing_rates       - Ambil tarif per owner
GET  /api/owner_invoices            - Ambil invoice owner
POST /api/owner_invoices            - Buat invoice baru
PATCH /api/owner_invoices/:id       - Update status invoice
```

## 8. Migrasi Database

Migrasi yang diperlukan:

```sql
-- Tambah informasi pemilik ke app_settings
INSERT INTO app_settings (key, value) VALUES
  ('platform_owner_name', 'PT HalalTrack Indonesia'),
  ('platform_owner_email', 'owner@halaltrack.id'),
  ('platform_owner_phone', '+62-21-XXXX-XXXX'),
  ('platform_support_email', 'support@halaltrack.id'),
  ('platform_support_phone', '+62-21-XXXX-XXXX');
```

## 9. Best Practices

### Untuk Super Admin

1. **Update Informasi Pemilik Secara Berkala**
   - Pastikan email dan telepon selalu aktif
   - Update alamat jika ada perubahan

2. **Review Tarif Secara Rutin**
   - Evaluasi tarif setiap kuartal
   - Sesuaikan dengan kondisi pasar

3. **Komunikasi Jelas dengan Owner**
   - Jelaskan perubahan tarif sebelumnya
   - Berikan waktu transisi yang cukup

### Untuk Owner

1. **Pantau Invoice Secara Rutin**
   - Cek estimasi tagihan setiap bulan
   - Bayar tepat waktu untuk menghindari denda

2. **Pahami Formula Perhitungan**
   - Ketahui tarif per sertifikat Anda
   - Hitung estimasi berdasarkan volume

3. **Hubungi Dukungan untuk Pertanyaan**
   - Jangan ragu menghubungi tim support
   - Tanyakan tentang paket atau tarif khusus

## 10. FAQ

**Q: Apakah tarif bisa berubah?**
A: Ya, tarif dapat berubah sesuai kesepakatan. Perubahan biasanya berlaku untuk periode billing berikutnya.

**Q: Bagaimana jika sertifikat dibatalkan?**
A: Sertifikat yang dibatalkan tidak akan ditagihkan. Hanya sertifikat dengan status "Selesai" yang masuk perhitungan.

**Q: Bisakah saya mengubah paket?**
A: Ya, Anda dapat mengubah paket kapan saja. Perubahan berlaku untuk periode billing berikutnya.

**Q: Metode pembayaran apa yang tersedia?**
A: Lihat halaman **Paket & Billing > Metode Pembayaran** untuk daftar lengkap.

**Q: Apakah ada diskon untuk volume tinggi?**
A: Hubungi tim kami di support@halaltrack.id untuk diskusi paket khusus.

---

**Terakhir Diperbarui**: 30 Maret 2026
**Versi**: 1.0
**Pemilik Dokumen**: Tim Platform HalalTrack
