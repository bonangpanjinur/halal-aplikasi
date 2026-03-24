# Rencana Perbaikan Strategis - Aplikasi Halal

Dokumen ini merinci rencana pengembangan dan perbaikan fitur untuk meningkatkan efisiensi operasional, transparansi komisi, dan fleksibilitas pengaturan platform.

---

## 1. Optimalisasi Modal Koneksi Akun UMKM
**Masalah:** Kesulitan dalam mencari akun UMKM jika jumlah data sangat besar.
**Solusi:** Implementasi fitur pencarian (search) pada modal pemilihan akun UMKM.

### Rencana Implementasi:
*   **Komponen UI:** Menggunakan komponen `Command` atau `Combobox` dari pustaka UI (shadcn/ui) yang mendukung *filtering* secara *real-time*.
*   **Fungsionalitas:**
    *   Input pencarian di bagian atas modal.
    *   *Debounced search* untuk mengurangi beban query ke database.
    *   Menampilkan informasi ringkas (Nama UMKM, Lokasi/ID) pada hasil pencarian.
*   **Teknis:** Integrasi dengan Supabase menggunakan query `ilike` untuk pencarian nama yang tidak sensitif terhadap huruf besar/kecil.

---

## 2. Sistem Pelacakan PIC pada Share Link
**Masalah:** Ketidakjelasan kepemilikan data yang masuk melalui share link, yang berdampak pada kesulitan perhitungan komisi.
**Solusi:** Penambahan atribut PIC (Person In Charge) pada setiap share link yang dibuat.

### Rencana Implementasi:
*   **Perubahan Database:** Menambahkan kolom `pic_id` (foreign key ke tabel users/profiles) pada tabel `share_links`.
*   **UI Pembuatan Link:** Menambahkan dropdown pemilihan PIC saat owner atau admin membuat link baru.
*   **Logika Bisnis:**
    *   Setiap data yang masuk melalui link tertentu akan secara otomatis ditandai dengan ID PIC tersebut.
    *   Sistem akan mencatat atribusi data ke PIC untuk keperluan kalkulasi komisi di akhir periode.
*   **Transparansi:** PIC dapat melihat performa link yang mereka kelola melalui dashboard pribadi.

---

## 3. Pengaturan Tarif Platform Kustom per Owner
**Masalah:** Tarif platform saat ini bersifat global, tidak bisa dibedakan antar owner yang mungkin memiliki kesepakatan berbeda.
**Solusi:** Fitur pengaturan tarif platform yang dapat dikonfigurasi secara individual oleh Super Admin.

### Rencana Implementasi:
*   **Akses Super Admin:** Menambahkan tab "Pengaturan Owner" pada halaman Management.
*   **Konfigurasi:**
    *   Input untuk menentukan persentase (%) atau nilai nominal tetap (flat fee) per transaksi/data untuk setiap owner.
    *   Riwayat perubahan tarif untuk audit trail.
*   **Integrasi Billing:** Logika perhitungan tagihan (billing) akan mengambil nilai tarif dari profil owner masing-masing, bukan dari nilai default sistem.

---

## 4. Dashboard Komisi Super Admin
**Masalah:** Super Admin kesulitan memantau piutang komisi dari para owner.
**Solusi:** Pembuatan halaman khusus untuk manajemen komisi yang komprehensif.

### Rencana Implementasi:
*   **Tampilan Utama:** Tabel daftar owner beserta status komisi mereka.
*   **Fitur Utama:**
    *   **Status Pembayaran:** Label jelas untuk "Perlu Dibayar", "Menunggu Verifikasi", dan "Sudah Dibayar".
    *   **Filter & Sortir:** Berdasarkan nama owner, rentang tanggal, dan status pembayaran.
    *   **Detail Transaksi:** Klik pada owner untuk melihat rincian data mana saja yang menghasilkan komisi tersebut.
*   **Aksi Cepat:** Tombol untuk menandai komisi sebagai "Sudah Dibayar" setelah verifikasi manual atau integrasi payment gateway.

---

## Tabel Estimasi Pengembangan

| Fitur | Prioritas | Estimasi Waktu | Kompleksitas |
| :--- | :--- | :--- | :--- |
| Pencarian Modal UMKM | Tinggi | 1-2 Hari | Rendah |
| Sistem PIC Share Link | Tinggi | 3-4 Hari | Menengah |
| Tarif Platform per Owner | Menengah | 2-3 Hari | Menengah |
| Dashboard Komisi | Tinggi | 4-5 Hari | Tinggi |

---

> **Catatan:** Seluruh perubahan database akan dilakukan melalui migrasi Supabase yang terstruktur untuk menjaga integritas data yang sudah ada.
