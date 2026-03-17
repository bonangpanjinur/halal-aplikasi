
Tujuan implementasi saya akan dibagi menjadi 6 bagian agar arsitekturnya rapi dan tetap dinamis untuk model sewa platform per owner.

1. Struktur role dan hirarki
- Pertahankan `super_admin` sebagai level tertinggi.
- Rapikan `owner` agar benar-benar “di bawah super_admin”, bukan setara penuh.
- Batasi akses owner di UI, route, dan query:
  - Owner bisa kelola admin/admin_input/lapangan/nib/umkm miliknya.
  - Owner tidak bisa kelola super_admin.
  - Super admin bisa kelola owner.
- Karena sistem sekarang belum punya konsep “milik owner”, saya akan tambahkan relasi tenant sederhana di backend, misalnya owner menjadi pemilik grup dan user-user operasional bekerja di grup milik owner.
- Semua tampilan yang saat ini masih memperlakukan owner seperti super_admin akan disesuaikan.

2. Tambah field akun per data
- Tambahkan 4 field baru pada `data_entries`:
  - `email_halal`
  - `sandi_halal`
  - `email_nib`
  - `sandi_nib`
- Form input/edit data akan diperbarui agar admin input bisa mengisi 2 pasang akun terpisah.
- Tabel data, export CSV, dan aturan field access akan diperluas agar field-field baru bisa diatur view/edit-nya secara dinamis.
- Field lama `email` dan `kata_sandi` perlu dimigrasikan strateginya:
  - paling aman: dipertahankan dulu untuk kompatibilitas lalu UI dialihkan ke field baru
  - sesudah stabil baru bisa dipensiunkan

3. Workflow status baru
- Tambahkan 2 status baru:
  - `revisi`
  - `selesai_revisi`
- Status config di seluruh app akan diselaraskan:
  - Group detail
  - Dashboard UMKM
  - Timeline/progress
  - Audit log label
  - Filter status
- Hak ubah status granular akan diperluas menjadi:
  - `status:revisi`
  - `status:selesai_revisi`
- Lalu dibatasi khusus untuk `owner`, `admin`, dan `admin_input`.
- Saya juga akan menutup celah saat ini: `owner` dan `admin` masih dianggap “super role” yang otomatis bisa semua status. Itu perlu diubah supaya pembatasan per status benar-benar berlaku sesuai kebutuhan.

4. PWA
- PWA dasar sebenarnya sudah ada:
  - `vite-plugin-pwa` sudah terpasang
  - manifest sudah ada
  - icon PWA sudah ada
  - denylist `/~oauth` sudah benar
- Yang belum terlihat adalah registrasi di client dan UX install.
- Saya akan:
  - daftarkan service worker di `main.tsx`
  - tambahkan indikator/install prompt sederhana
  - lengkapi meta mobile di `index.html`
  - pastikan nama app/ikon/manifest konsisten
- Ini membuat PWA benar-benar aktif, bukan hanya terpasang paketnya.

5. Komisi dan tagihan owner
- Hapus komisi untuk `super_admin` dari sisi pengaturan dan logic.
- Super admin tetap bisa memantau, tetapi tidak lagi menerima komisi.
- Tambahkan konsep “tagihan owner per sertifikat”:
  - saat data mencapai `sertifikat_selesai`, sistem membuat draft tagihan platform untuk owner terkait
  - super admin bisa koreksi/konfirmasi manual
- Karena Anda ingin model sewa platform dinamis, saya sarankan tambahkan tabel baru:
  - `owner_settings` atau setara: pengaturan per owner
  - `owner_billing_rates`: tarif platform per sertifikat
  - `owner_invoices` / `owner_invoice_items`: tagihan owner dan rinciannya
- Super admin mengatur tarif platform untuk owner.
- Owner nantinya bisa melihat tagihannya sendiri, tapi tidak bisa mengubah tarif platform yang ditetapkan super admin.

6. Pengaturan berjenjang
- Saat ini `AppSettings` bersifat global.
- Saya akan pecah menjadi 2 level:
  - Pengaturan super admin: global + owner management + tarif platform owner
  - Pengaturan owner: tarif komisi untuk role di bawah owner
- Dari jawaban Anda, owner minimal harus bisa atur `tarif komisi`.
- Agar benar-benar multi-owner, pengaturan komisi tidak boleh lagi hanya 1 tabel global per role. Perlu scope per owner.
- Saya sarankan ubah desain komisi dari:
  - `commission_rates(role)`
  menjadi
  - `commission_rates(owner_id, role, amount_per_entry)`
- Lalu semua perhitungan komisi mengambil rate sesuai owner dari data/grup terkait.
- Ini akan membuat owner bisa mengatur admin-admin di bawahnya tanpa mengganggu owner lain.

Perubahan backend yang diperlukan
- Migration enum status:
  - tambah `revisi`, `selesai_revisi`
- Migration `data_entries`:
  - tambah 4 kolom akun baru
- Migration model multi-owner:
  - tambahkan kepemilikan owner pada `groups` atau tabel relasi khusus
  - opsional: tambahkan relasi user ke owner scope bila perlu
- Migration billing:
  - tabel tarif platform owner
  - tabel tagihan owner + item tagihan
- Sesuaikan RLS:
  - super_admin: akses penuh lintas owner
  - owner: hanya data miliknya
  - role bawah owner: hanya data dalam grup owner tersebut
- Sesuaikan trigger/fungsi:
  - komisi tidak lagi untuk super_admin
  - pembuatan draft tagihan owner saat `sertifikat_selesai`

File yang kemungkinan akan diubah
- `src/components/DataEntryForm.tsx`
- `src/pages/GroupDetail.tsx`
- `src/pages/AppSettings.tsx`
- `src/pages/Komisi.tsx`
- `src/pages/UmkmDashboard.tsx`
- `src/components/AppLayout.tsx`
- `src/App.tsx`
- `src/hooks/useFieldAccess.ts`
- `src/contexts/AuthContext.tsx`
- `src/pages/UsersManagement.tsx`
- migrasi baru di `supabase/migrations/*`

Catatan desain penting
- Saat ini owner sudah ada, tetapi implementasinya masih hampir setara super_admin. Saya akan refactor itu agar hirarki benar.
- Saat ini permission field/status masih global per role. Untuk kebutuhan “owner mengatur admin di bawahnya”, permission dan rate idealnya perlu scoped per owner. Kalau tidak, perubahan satu owner akan memengaruhi semua owner.
- Jadi implementasi yang benar untuk visi platform sewa ini adalah beralih dari sistem global menjadi tenant-aware.

Urutan implementasi yang saya sarankan
1. Rapikan hirarki role owner vs super_admin
2. Tambah field akun halal/nib
3. Tambah status revisi + permission status
4. Aktifkan PWA sepenuhnya
5. Hapus komisi super_admin
6. Tambah fondasi multi-owner untuk komisi owner dan tagihan owner
7. Pecah pengaturan super_admin vs pengaturan owner

Bagian teknis yang paling krusial
```text
super_admin
  └─ owner
      ├─ admin
      ├─ admin_input
      ├─ lapangan
      ├─ nib
      └─ umkm
```

```text
Owner scope diperlukan agar:
- komisi per owner terpisah
- setting komisi owner tidak global
- tagihan platform owner bisa dihitung akurat
- owner hanya melihat user/data miliknya
```

```text
Tanpa scope owner di database, fitur:
- "pengaturan owner untuk admin-adminnya"
- "tagihan owner per sertifikat"
- "multi-tenant platform sewa"
akan sulit aman dan akan bercampur antar owner.
```
