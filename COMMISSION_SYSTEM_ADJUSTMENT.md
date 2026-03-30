# Penyesuaian Sistem Komisi & Gaji - Dokumentasi Teknis

## Ringkasan Perubahan

Sistem komisi telah diubah dari model **"Admin menerima komisi per sertifikat"** menjadi model **"Owner membayar komisi atau gaji kepada team mereka (Admin, Lapangan, NIB, dll)"**.

---

## 1. Perubahan Database

### Tabel: `profiles`

Menambahkan kolom baru untuk menyimpan pengaturan komisi/gaji per user:

```sql
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'per_certificate' 
  CHECK (commission_type IN ('per_certificate', 'monthly_salary')),
ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS transport_allowance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_ktp INTEGER DEFAULT 130,
ADD COLUMN IF NOT EXISTS over_target_rate NUMERIC DEFAULT 25000;
```

**Penjelasan Kolom:**
- `commission_type`: Jenis pembayaran - "per_certificate" (komisi per sertifikat) atau "monthly_salary" (gaji bulanan)
- `monthly_salary`: Nominal gaji pokok per bulan (jika menggunakan monthly_salary)
- `transport_allowance`: Uang transport/tunjangan harian
- `target_ktp`: Target jumlah KTP yang harus dicapai per bulan (default: 130)
- `over_target_rate`: Bonus per KTP jika melebihi target (default: Rp 25.000)

---

## 2. Logika Perhitungan Komisi/Gaji

### Formula Pendapatan Bulanan untuk Admin/Team:

```
Total Pendapatan = Komisi/Gaji Pokok + Uang Transport + Bonus Kelebihan Target

Dimana:
- Komisi/Gaji Pokok = 
    * Jika per_certificate: (Jumlah Sertifikat Selesai × Tarif Komisi)
    * Jika monthly_salary: Nominal Gaji Pokok
    
- Uang Transport = Nominal Transport Allowance (tetap setiap bulan)

- Bonus Kelebihan Target = 
    * Jika Jumlah KTP > Target: (Jumlah KTP - Target) × Over Target Rate
    * Jika Jumlah KTP ≤ Target: 0
```

### Contoh Perhitungan:

**Skenario 1: Admin dengan Komisi Per Sertifikat**
- Tarif Komisi: Rp 5.000 per sertifikat
- Uang Transport: Rp 50.000
- Target KTP: 130
- Bonus per KTP: Rp 25.000
- Hasil Bulan Ini: 150 sertifikat selesai

```
Komisi Pokok = 150 × Rp 5.000 = Rp 750.000
Uang Transport = Rp 50.000
Bonus = (150 - 130) × Rp 25.000 = 20 × Rp 25.000 = Rp 500.000
─────────────────────────────────────
Total = Rp 750.000 + Rp 50.000 + Rp 500.000 = Rp 1.300.000
```

**Skenario 2: Admin dengan Gaji Bulanan**
- Gaji Pokok: Rp 2.000.000
- Uang Transport: Rp 100.000
- Target KTP: 130
- Bonus per KTP: Rp 25.000
- Hasil Bulan Ini: 140 sertifikat selesai

```
Gaji Pokok = Rp 2.000.000
Uang Transport = Rp 100.000
Bonus = (140 - 130) × Rp 25.000 = 10 × Rp 25.000 = Rp 250.000
─────────────────────────────────────
Total = Rp 2.000.000 + Rp 100.000 + Rp 250.000 = Rp 2.350.000
```

---

## 3. Perubahan Frontend

### A. Halaman: Kelola User (`UsersManagement.tsx`)

**Tambahan:**
- Tombol **"Pengaturan Komisi"** (ikon kalkulator) pada setiap user
- Dialog untuk mengatur:
  - Jenis komisi (per sertifikat / gaji bulanan)
  - Nominal gaji pokok (jika gaji bulanan)
  - Uang transport
  - Target KTP
  - Bonus per KTP melebihi target

**Akses:**
- Owner dapat mengatur komisi untuk user di bawahnya
- Super Admin dapat mengatur komisi untuk semua user

### B. Halaman: Komisi & Saldo (`Komisi.tsx`)

**Perubahan:**
- Menampilkan **Estimasi Pendapatan Periode Ini** berdasarkan pengaturan komisi user
- Rincian breakdown:
  - Komisi/Gaji Pokok
  - Uang Transport
  - Bonus Melebihi Target
  - Total Estimasi

**UI Baru:**
- Card "Rincian Estimasi Pendapatan" dengan grid 4 kolom
- Menampilkan jumlah KTP vs target
- Menampilkan bonus yang akan diterima

### C. Halaman: Pengaturan Owner (`AppSettings.tsx`)

**Tab: Komisi Tim (untuk Owner)**

Struktur baru dengan 2 section:

#### Section 1: Tarif Komisi Tim (Existing)
- Mengatur tarif komisi per sertifikat untuk setiap role
- Ini adalah tarif default yang digunakan jika user memilih "per_certificate"

#### Section 2: Pengaturan Komisi & Gaji per Role (NEW)
- Card dengan gradient background (primary/5 to primary/10)
- Untuk setiap role (admin, admin_input, lapangan, nib):
  - **Jenis Komisi**: Dropdown (Komisi Per Sertifikat / Gaji Per Bulan)
  - **Gaji Pokok**: Input number (Rp)
  - **Uang Transport**: Input number (Rp)
  - **Target KTP/Bulan**: Input number (default: 130)
  - **Bonus per KTP Melebihi Target**: Input number (Rp, default: 25.000)

---

## 4. Perubahan Backend

### Database Functions

#### Function: `auto_create_commission()`

**Perubahan Logika:**
- Ketika entry baru dibuat dengan pic_user_id:
  - Jika user memiliki `commission_type = 'monthly_salary'`: Insert komisi dengan amount = 0 (hanya untuk tracking jumlah KTP)
  - Jika user memiliki `commission_type = 'per_certificate'`: Insert komisi dengan amount dari commission_rates

**Tujuan:** Menghitung jumlah KTP untuk menentukan bonus melebihi target

#### Function: `auto_create_commission_on_status_change()`

**Perubahan Logika:** Sama seperti di atas

---

## 5. Alur Data

### Alur Perhitungan Komisi/Gaji:

```
1. User (Admin/Team) membuat/mengubah entry data
   ↓
2. Trigger: auto_create_commission() atau auto_create_commission_on_status_change()
   ↓
3. Cek commission_type dari profiles user:
   - Jika 'per_certificate': Insert komisi dengan amount dari commission_rates
   - Jika 'monthly_salary': Insert komisi dengan amount = 0
   ↓
4. Setiap bulan, sistem menghitung total:
   - Jumlah KTP = COUNT(commissions WHERE period = current_month)
   - Komisi/Gaji Pokok = (per_certificate) ? sum(amount) : monthly_salary
   - Uang Transport = transport_allowance
   - Bonus = (jumlah_ktp > target) ? (jumlah_ktp - target) * over_target_rate : 0
   - Total = Komisi/Gaji + Transport + Bonus
   ↓
5. Tampilkan di halaman Komisi & Saldo
```

---

## 6. Tabel Pengaturan per Role

### Contoh Konfigurasi Owner untuk Timnya:

| Role | Jenis Komisi | Gaji Pokok | Transport | Target KTP | Bonus/KTP |
|------|--------------|-----------|-----------|-----------|-----------|
| Admin | Per Sertifikat | - | Rp 50.000 | 130 | Rp 25.000 |
| Admin Input | Gaji Bulanan | Rp 2.000.000 | Rp 100.000 | 130 | Rp 25.000 |
| Lapangan | Per Sertifikat | - | Rp 75.000 | 130 | Rp 30.000 |
| NIB | Gaji Bulanan | Rp 1.500.000 | Rp 50.000 | 100 | Rp 20.000 |

---

## 7. Implementasi Checklist

- [x] Tambah kolom ke tabel `profiles`
- [x] Update TypeScript types di `types.ts`
- [x] Tambah UI di `UsersManagement.tsx` untuk pengaturan komisi per user
- [x] Update `Komisi.tsx` untuk menampilkan estimasi pendapatan
- [x] Buat UI baru di `AppSettings.tsx` untuk pengaturan komisi per role
- [ ] Implementasi API/function untuk menyimpan pengaturan komisi per role
- [ ] Update database triggers untuk menangani commission_type
- [ ] Testing perhitungan komisi dengan berbagai skenario
- [ ] Testing UI responsiveness di mobile
- [ ] Documentation untuk end-user

---

## 8. Catatan Penting

### Migrasi Data Existing:

Jika sudah ada data komisi existing, perlu dilakukan:
1. Set default `commission_type = 'per_certificate'` untuk semua user existing
2. Set `monthly_salary = 0` untuk semua user existing
3. Set `transport_allowance = 0` untuk semua user existing
4. Set `target_ktp = 130` untuk semua user existing
5. Set `over_target_rate = 25000` untuk semua user existing

### Backward Compatibility:

- Sistem tetap support komisi per sertifikat (existing behavior)
- Tambahan support untuk gaji bulanan + bonus
- Uang transport bisa ditambahkan ke kedua jenis komisi

---

## 9. Contoh Query untuk Perhitungan

### Query untuk menghitung total pendapatan user per bulan:

```sql
SELECT 
  p.id,
  p.full_name,
  p.commission_type,
  COUNT(c.id) as total_ktp,
  p.target_ktp,
  CASE 
    WHEN p.commission_type = 'per_certificate' 
    THEN SUM(c.amount)
    ELSE p.monthly_salary
  END as base_income,
  p.transport_allowance,
  CASE 
    WHEN COUNT(c.id) > p.target_ktp 
    THEN (COUNT(c.id) - p.target_ktp) * p.over_target_rate
    ELSE 0
  END as bonus,
  CASE 
    WHEN p.commission_type = 'per_certificate' 
    THEN SUM(c.amount)
    ELSE p.monthly_salary
  END + p.transport_allowance + 
  CASE 
    WHEN COUNT(c.id) > p.target_ktp 
    THEN (COUNT(c.id) - p.target_ktp) * p.over_target_rate
    ELSE 0
  END as total_income
FROM profiles p
LEFT JOIN commissions c ON p.id = c.user_id 
  AND c.period = '2026-03'
GROUP BY p.id, p.full_name, p.commission_type, p.monthly_salary, 
         p.transport_allowance, p.target_ktp, p.over_target_rate;
```

---

## 10. UI Layout Reference

### AppSettings.tsx - Komisi Tab (Owner View)

```
┌─────────────────────────────────────────────────────────────┐
│ Tarif Komisi Tim                                            │
│ Atur jumlah komisi yang didapatkan tim Anda...             │
├─────────────────────────────────────────────────────────────┤
│ Admin          │ Rp [5000]                                  │
│ Admin Input    │ Rp [0]                                     │
│ Lapangan       │ Rp [10001]                                 │
│ NIB            │ Rp [5000]                                  │
│                                                              │
│ [Simpan Tarif Komisi Tim]                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Pengaturan Komisi & Gaji per Role                           │
│ Atur skema pembayaran untuk setiap role...                 │
├─────────────────────────────────────────────────────────────┤
│ ADMIN                                                        │
│ ├─ Jenis Komisi: [Komisi Per Sertifikat ▼]                │
│ ├─ Gaji Pokok: Rp [0]                                       │
│ ├─ Uang Transport: Rp [50000]                               │
│ ├─ Target KTP/Bulan: [130]                                  │
│ └─ Bonus per KTP: Rp [25000]                                │
│                                                              │
│ ADMIN INPUT                                                  │
│ ├─ Jenis Komisi: [Gaji Per Bulan ▼]                        │
│ ├─ Gaji Pokok: Rp [2000000]                                 │
│ ├─ Uang Transport: Rp [100000]                              │
│ ├─ Target KTP/Bulan: [130]                                  │
│ └─ Bonus per KTP: Rp [25000]                                │
│                                                              │
│ ... (roles lainnya)                                          │
│                                                              │
│ [Simpan Semua Pengaturan Komisi]                            │
└─────────────────────────────────────────────────────────────┘
```

### Komisi.tsx - Estimasi Pendapatan

```
┌──────────────────────────────────────────────────────────────────┐
│ Rincian Estimasi Pendapatan (Bulan Ini)                         │
├──────────────────────────────────────────────────────────────────┤
│ Komisi Per Sertifikat │ Uang Transport │ Bonus Melebihi │ Total │
│ Rp 750.000            │ Rp 50.000      │ Rp 500.000     │ Rp   │
│ 150 sertifikat selesai│                │ 20 KTP di atas │ 1.3M  │
│                       │                │ target (130)   │       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 11. Testing Scenarios

### Test Case 1: Komisi Per Sertifikat
- User: Admin dengan komisi Rp 5.000/sertifikat
- Transport: Rp 50.000
- Target: 130, Bonus: Rp 25.000
- Hasil: 150 sertifikat
- Expected: Rp 750.000 + Rp 50.000 + Rp 500.000 = Rp 1.300.000

### Test Case 2: Gaji Bulanan
- User: Admin Input dengan gaji Rp 2.000.000
- Transport: Rp 100.000
- Target: 130, Bonus: Rp 25.000
- Hasil: 140 sertifikat
- Expected: Rp 2.000.000 + Rp 100.000 + Rp 250.000 = Rp 2.350.000

### Test Case 3: Tidak Mencapai Target
- User: Lapangan dengan komisi Rp 10.000/sertifikat
- Transport: Rp 75.000
- Target: 130, Bonus: Rp 30.000
- Hasil: 120 sertifikat
- Expected: Rp 1.200.000 + Rp 75.000 + Rp 0 = Rp 1.275.000

---

## 12. Future Enhancements

- [ ] Laporan bulanan otomatis untuk setiap user
- [ ] Export laporan komisi ke Excel/PDF
- [ ] Notifikasi ketika user mencapai target
- [ ] Dashboard analytics untuk Owner melihat cost breakdown
- [ ] Approval workflow untuk pembayaran komisi
- [ ] Integration dengan sistem pembayaran otomatis
