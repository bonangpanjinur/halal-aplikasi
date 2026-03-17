# Panduan Pengguna: Fitur Billing dan Multi-Owner Aplikasi Halal

**Tanggal Dokumen**: 17 Maret 2026  
**Penyusun**: Manus AI Agent  
**Versi**: 1.0

---

## Pendahuluan

Dokumen ini adalah panduan komprehensif untuk fitur billing dan multi-owner yang baru diimplementasikan dalam Aplikasi Halal. Fitur-fitur ini dirancang untuk memberikan fleksibilitas yang lebih besar dalam pengelolaan pengguna, data, dan model monetisasi platform. Panduan ini akan menjelaskan bagaimana pengguna dengan peran `Owner` dan `Super Admin` dapat memanfaatkan fungsionalitas baru ini secara efektif.

---

## 1. Untuk Peran Owner

Sebagai seorang `Owner`, Anda memiliki kontrol penuh atas tenant Anda sendiri, termasuk pengelolaan pengguna di bawah Anda, grup data, dan kini, penagihan untuk layanan sertifikasi halal.

### 1.1 Halaman Paket & Billing (`/billing`)

Halaman ini adalah pusat pengelolaan penagihan Anda. Anda dapat mengaksesnya melalui menu navigasi di sidebar dengan label "Paket & Billing".

#### 1.1.1 Paket Saat Ini

Bagian ini menampilkan detail paket langganan Anda saat ini, termasuk:
- **Nama Paket**: Tingkat paket yang Anda pilih (misalnya, Starter, Professional, Enterprise).
- **Deskripsi**: Penjelasan singkat tentang paket.
- **Biaya Dasar**: Biaya bulanan tetap untuk paket Anda.
- **Biaya per Sertifikat**: Biaya tambahan yang dikenakan untuk setiap sertifikat yang berhasil diselesaikan di bawah tenant Anda.

Anda juga akan menemukan opsi untuk `Upgrade Paket` jika Anda ingin beralih ke tingkat layanan yang lebih tinggi.

#### 1.1.2 Estimasi Tagihan Berjalan

Bagian ini memberikan gambaran real-time tentang estimasi tagihan Anda untuk bulan berjalan. Ini mencakup:
- **Biaya Berlangganan**: Biaya dasar paket Anda.
- **Biaya Sertifikat (Usage)**: Total biaya yang diakumulasikan dari sertifikat yang telah diselesaikan pada periode billing saat ini.
- **Total Estimasi**: Jumlah dari biaya dasar dan biaya usage.

#### 1.1.3 Riwayat Invoice

Tabel ini mencantumkan semua invoice yang telah diterbitkan untuk tenant Anda, dengan detail sebagai berikut:
- **Periode**: Bulan dan tahun invoice.
- **Status**: Status pembayaran invoice (misalnya, Lunas, Draft, Belum Bayar).
- **Biaya Dasar**: Biaya dasar paket untuk periode tersebut.
- **Biaya Usage**: Biaya berdasarkan jumlah sertifikat yang diselesaikan.
- **Total Tagihan**: Jumlah total yang harus dibayar.
- **Tanggal Bayar**: Tanggal invoice dilunasi.
- **Aksi**: Tombol untuk melihat detail invoice lebih lanjut atau mengunduh dokumen invoice (jika tersedia).

### 1.2 Pengelolaan Pengguna (UsersManagement)

Sebagai `Owner`, Anda dapat membuat dan mengelola pengguna dengan peran operasional (Admin, Lapangan, NIB) di bawah tenant Anda. Pengguna yang Anda buat akan secara otomatis terikat dengan `owner_id` Anda, memastikan pemisahan data yang ketat.

---

## 2. Untuk Peran Super Admin

Sebagai `Super Admin`, Anda memiliki akses penuh ke seluruh platform, termasuk konfigurasi global dan manajemen penagihan untuk semua `Owner`.

### 2.1 Halaman Manajemen Penagihan Platform (`/billing-management`)

Halaman ini adalah dasbor utama Anda untuk mengelola sistem billing platform. Anda dapat mengaksesnya melalui menu navigasi di sidebar dengan label "Penagihan".

#### 2.1.1 Generate Invoice Bulan Ini

Tombol "Generate Invoice Bulan Ini" memungkinkan Anda untuk secara manual memicu proses pembuatan invoice bulanan untuk semua `Owner`. Sistem akan menghitung biaya berdasarkan paket langganan masing-masing `Owner` dan jumlah sertifikat yang telah diselesaikan pada periode tersebut. Invoice yang dihasilkan akan memiliki status `draft` dan dapat ditinjau lebih lanjut.

#### 2.1.2 Daftar Paket

Tab ini menampilkan semua paket langganan yang tersedia di platform. Anda dapat:
- **Mengubah Detail Paket**: Sesuaikan nama, deskripsi, biaya dasar, dan biaya per sertifikat untuk setiap paket.
- **Menyimpan Perubahan**: Klik "Simpan Perubahan" setelah melakukan modifikasi pada detail paket.

#### 2.1.3 Langganan Owner

Tab ini memberikan gambaran umum tentang semua `Owner` yang terdaftar di platform dan status langganan mereka. Anda dapat melihat:
- **Owner**: Nama atau email `Owner`.
- **Paket Aktif**: Paket langganan yang sedang digunakan oleh `Owner` tersebut.
- **Status**: Status langganan (misalnya, aktif).
- **Tanggal Mulai**: Tanggal mulai langganan.
- **Aksi**: Opsi untuk mengubah paket langganan `Owner` secara manual.

#### 2.1.4 Semua Invoice

Tab ini akan menampilkan daftar semua invoice yang telah dibuat untuk semua `Owner` di platform. Ini memungkinkan Anda untuk melacak status pembayaran, melihat detail invoice, dan melakukan tindakan administratif lainnya.

---

## Kesimpulan

Fitur billing dan multi-owner yang baru ini dirancang untuk memberikan kontrol dan transparansi yang lebih baik dalam pengelolaan Aplikasi Halal. Dengan memahami dan memanfaatkan panduan ini, `Owner` dapat mengelola penagihan mereka secara efisien, sementara `Super Admin` dapat mengelola seluruh ekosistem billing platform dengan mudah.
