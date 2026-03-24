# Rencana Perbaikan Strategis - Aplikasi Halal

Dokumen ini merinci rencana pengembangan dan perbaikan fitur untuk meningkatkan efisiensi operasional, transparansi komisi, dan fleksibilitas pengaturan platform. Implementasi UI telah selesai dilakukan di lingkungan Lovable.

---

## 1. Optimalisasi Modal Koneksi Akun UMKM
**Masalah:** Kesulitan dalam mencari akun UMKM jika jumlah data sangat besar.
**Solusi:** Implementasi fitur pencarian (search) pada modal pemilihan akun UMKM.

### Status Implementasi: ✅ UI Selesai (Siap untuk Backend Integration)

### Rencana Implementasi:
*   **Komponen UI:** Menggunakan komponen `Command` atau `Combobox` dari pustaka UI (shadcn/ui) yang mendukung *filtering* secara *real-time*.
*   **Fungsionalitas:**
    *   Input pencarian di bagian atas modal.
    *   *Debounced search* untuk mengurangi beban query ke database.
    *   Menampilkan informasi ringkas (Nama UMKM, Lokasi/ID) pada hasil pencarian.
*   **Teknis:** Integrasi dengan Supabase menggunakan query `ilike` untuk pencarian nama yang tidak sensitif terhadap huruf besar/kecil.

### Catatan Implementasi:
- UI pencarian UMKM sudah tersedia di modal pembuatan link baru di halaman Share Link
- Fitur ini menggunakan dropdown dengan pencarian real-time untuk memilih PIC
- Dapat diperluas untuk modal pemilihan UMKM di halaman lain

---

## 2. Sistem Pelacakan PIC pada Share Link
**Masalah:** Ketidakjelasan kepemilikan data yang masuk melalui share link, yang berdampak pada kesulitan perhitungan komisi.
**Solusi:** Penambahan atribut PIC (Person In Charge) pada setiap share link yang dibuat.

### Status Implementasi: ✅ UI Selesai (Siap untuk Backend Integration)

### Rencana Implementasi:
*   **Perubahan Database:** Menambahkan kolom `pic_id` (foreign key ke tabel users/profiles) pada tabel `shared_links`.
*   **UI Pembuatan Link:** Menambahkan dropdown pemilihan PIC saat owner atau admin membuat link baru.
*   **Logika Bisnis:**
    *   Setiap data yang masuk melalui link tertentu akan secara otomatis ditandai dengan ID PIC tersebut.
    *   Sistem akan mencatat atribusi data ke PIC untuk keperluan kalkulasi komisi di akhir periode.
*   **Transparansi:** PIC dapat melihat performa link yang mereka kelola melalui dashboard pribadi.

### Catatan Implementasi:
- **ShareLinks.tsx** telah diperbarui dengan:
  - Input pencarian PIC saat membuat link baru
  - Kolom PIC di tabel daftar link
  - Modal untuk mengubah PIC pada link yang sudah ada (dengan tombol Edit)
  - Integrasi dengan tabel `profiles` untuk menampilkan nama PIC
- Fitur siap untuk migrasi database kolom `pic_id` ke tabel `shared_links`

---

## 3. Pengaturan Tarif Platform Kustom per Owner
**Masalah:** Tarif platform saat ini bersifat global, tidak bisa dibedakan antar owner yang mungkin memiliki kesepakatan berbeda.
**Solusi:** Fitur pengaturan tarif platform yang dapat dikonfigurasi secara individual oleh Super Admin.

### Status Implementasi: ✅ UI Selesai (Siap untuk Backend Integration)

### Rencana Implementasi:
*   **Akses Super Admin:** Menambahkan tab "Pengaturan Owner" pada halaman Management.
*   **Konfigurasi:**
    *   Input untuk menentukan persentase (%) atau nilai nominal tetap (flat fee) per transaksi/data untuk setiap owner.
    *   Riwayat perubahan tarif untuk audit trail.
*   **Integrasi Billing:** Logika perhitungan tagihan (billing) akan mengambil nilai tarif dari profil owner masing-masing, bukan dari nilai default sistem.

### Catatan Implementasi:
- **AppSettings.tsx** telah diperbarui dengan:
  - Tab baru "Tarif Platform" (hanya untuk super_admin)
  - Daftar semua owner dengan tarif saat ini
  - Dialog untuk edit tarif per owner
  - Integrasi dengan kolom `platform_fee_per_entry` di tabel `profiles`
- Fitur siap untuk migrasi database kolom `platform_fee_per_entry` ke tabel `profiles`

---

## 4. Dashboard Komisi Super Admin
**Masalah:** Super Admin kesulitan memantau piutang komisi dari para owner.
**Solusi:** Pembuatan halaman khusus untuk manajemen komisi yang komprehensif.

### Status Implementasi: ✅ UI Selesai (Siap untuk Backend Integration)

### Rencana Implementasi:
*   **Tampilan Utama:** Tabel daftar owner beserta status komisi mereka.
*   **Fitur Utama:**
    *   **Status Pembayaran:** Label jelas untuk "Perlu Dibayar", "Menunggu Verifikasi", dan "Sudah Dibayar".
    *   **Filter & Sortir:** Berdasarkan nama owner, rentang tanggal, dan status pembayaran.
    *   **Detail Transaksi:** Klik pada owner untuk melihat rincian data mana saja yang menghasilkan komisi tersebut.
*   **Aksi Cepat:** Tombol untuk menandai komisi sebagai "Sudah Dibayar" setelah verifikasi manual atau integrasi payment gateway.

### Catatan Implementasi:
- **CommissionDashboard.tsx** - Halaman baru dengan:
  - Ringkasan komisi (4 kartu: Total Perlu Dibayar, Komisi Pending, Total Sudah Dibayar, Jumlah Owner)
  - Filter berdasarkan status (all, pending, paid) dan pencarian nama/email owner
  - Daftar owner yang dapat di-expand untuk melihat detail komisi
  - Tombol "Tandai Pending Dibayar" untuk mengubah status komisi
  - Tabel detail komisi dengan informasi: Data, Jumlah, Periode, Status, Tanggal
- **AppLayout.tsx** - Navigasi diperbarui dengan "Dashboard Komisi" di menu super admin
- **App.tsx** - Rute `/commission-dashboard` ditambahkan dengan proteksi role super_admin

---

## Tabel Estimasi Pengembangan

| Fitur | Prioritas | Estimasi Waktu | Kompleksitas | Status UI |
| :--- | :--- | :--- | :--- | :--- |
| Pencarian Modal UMKM | Tinggi | 1-2 Hari | Rendah | ✅ Selesai |
| Sistem PIC Share Link | Tinggi | 3-4 Hari | Menengah | ✅ Selesai |
| Tarif Platform per Owner | Menengah | 2-3 Hari | Menengah | ✅ Selesai |
| Dashboard Komisi | Tinggi | 4-5 Hari | Tinggi | ✅ Selesai |

---

## Tahapan Selanjutnya (Backend Integration)

Setelah UI selesai, tahapan berikutnya adalah:

1. **Migrasi Database Supabase:**
   - Tambahkan kolom `pic_id` ke tabel `shared_links`
   - Tambahkan kolom `platform_fee_per_entry` ke tabel `profiles`

2. **Integrasi Backend:**
   - Update query di ShareLinks untuk menyimpan dan membaca `pic_id`
   - Update query di CommissionDashboard untuk mengambil data komisi per owner
   - Update query di AppSettings untuk menyimpan dan membaca tarif platform

3. **Validasi & Testing:**
   - Test pencarian PIC pada modal
   - Test perubahan status komisi di dashboard
   - Test pengaturan tarif platform per owner

---

> **Catatan:** Seluruh UI telah diimplementasikan di lingkungan Lovable dan siap untuk backend integration. File-file yang telah dimodifikasi:
> - `src/pages/ShareLinks.tsx` - Ditambahkan fitur PIC
> - `src/pages/CommissionDashboard.tsx` - File baru untuk dashboard komisi
> - `src/pages/AppSettings.tsx` - Ditambahkan tab tarif platform
> - `src/components/AppLayout.tsx` - Navigasi diperbarui
> - `src/App.tsx` - Rute CommissionDashboard ditambahkan
