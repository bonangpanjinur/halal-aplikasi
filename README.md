# HalalTrack - Platform Pelacakan Sertifikasi Halal

HalalTrack adalah platform manajemen dan pelacakan sertifikasi halal yang dirancang untuk memudahkan UMKM dan pengelola sertifikasi dalam memantau proses sertifikasi secara transparan dan efisien.

## Fitur Utama

- **Pelacakan Real-time**: Pantau status sertifikasi halal Anda secara langsung.
- **Manajemen Multi-Owner**: Arsitektur SaaS yang mendukung banyak pengelola (owner) dalam satu platform.
- **Sistem Billing Transparan**: Perhitungan tarif platform yang jelas berdasarkan volume sertifikat.
- **Dashboard Komprehensif**: Visualisasi data untuk Super Admin, Owner, dan UMKM.

## Informasi Tarif & Pemilik

Kami menjunjung tinggi transparansi dalam operasional platform kami.

### Pemilik Platform
Platform ini dimiliki dan dioperasikan oleh **PT HalalTrack Indonesia**. 
Detail kontak pemilik dapat ditemukan di halaman [Pricing & Info Pemilik](/pricing) atau di dashboard Owner.

### Struktur Tarif
Tarif platform dihitung menggunakan model hybrid:
**Total Tagihan = Biaya Dasar + (Biaya per Sertifikat × Jumlah Sertifikat Selesai)**

| Paket | Biaya Dasar | Biaya per Sertifikat |
|-------|-------------|----------------------|
| **Starter** | Rp 0 | Rp 25.000 |
| **Professional** | Rp 500.000 | Rp 15.000 |
| **Enterprise** | Rp 2.000.000 | Rp 5.000 |

Untuk detail lebih lanjut, silakan baca [Dokumentasi Tarif & Info Pemilik](docs/PRICING_AND_OWNER_INFO.md).

## Dokumentasi Teknis

- [Struktur Role & Hirarki](docs/ROLE_HIERARCHY.md)
- [Panduan Billing & Multi-Owner](docs/PANDUAN_PENGGUNA_BILLING.md)
- [Detail Tarif & Info Pemilik](docs/PRICING_AND_OWNER_INFO.md)

## Teknologi yang Digunakan

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn-ui
- **Backend/Database**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **PWA**: Mendukung instalasi aplikasi di perangkat mobile

## Cara Pengembangan Lokal

1. Clone repositori ini
2. Instal dependensi: `npm install`
3. Jalankan server pengembangan: `npm run dev`
4. Buka `http://localhost:5173` di browser Anda

---

© 2026 HalalTrack Indonesia. Seluruh hak cipta dilindungi undang-undang.
