# Fase 3: Pengembangan Fitur Akun Per Data dan Workflow Status Baru

**Status**: ✅ **SELESAI**  
**Tanggal Selesai**: 17 Maret 2026  
**Commit Reference**: Phase 3 implementation complete

---

## Ringkasan Fase 3

Fase 3 merupakan pengembangan signifikan yang menambahkan kemampuan manajemen akun per data entry dan workflow status yang lebih fleksibel. Implementasi ini memungkinkan sistem untuk mengelola kredensial akun Halal dan NIB secara terpisah per UMKM, serta mendukung siklus perbaikan data melalui status `revisi` dan `selesai_revisi`.

---

## 1. Field Akun Baru

### 1.1 Spesifikasi Field

Empat field baru telah ditambahkan ke tabel `data_entries`:

| Field | Tipe | Deskripsi | Nullable |
| :--- | :--- | :--- | :--- |
| `email_halal` | TEXT | Email akun untuk portal Halal | Yes |
| `sandi_halal` | TEXT | Password akun Halal (disimpan sebagai plaintext untuk kemudahan) | Yes |
| `email_nib` | TEXT | Email akun untuk portal NIB | Yes |
| `sandi_nib` | TEXT | Password akun NIB (disimpan sebagai plaintext untuk kemudahan) | Yes |

### 1.2 Database Migration

File migration: `supabase/migrations/20260317090000_phase_3_updates.sql`

```sql
ALTER TABLE public.data_entries 
ADD COLUMN IF NOT EXISTS email_halal TEXT,
ADD COLUMN IF NOT EXISTS sandi_halal TEXT,
ADD COLUMN IF NOT EXISTS email_nib TEXT,
ADD COLUMN IF NOT EXISTS sandi_nib TEXT;
```

### 1.3 TypeScript Types

Semua field sudah didefinisikan di `src/integrations/supabase/types.ts`:

```typescript
data_entries: {
  Row: {
    email_halal: string | null
    sandi_halal: string | null
    email_nib: string | null
    sandi_nib: string | null
    // ... field lainnya
  }
  Insert: { /* ... */ }
  Update: { /* ... */ }
}
```

---

## 2. Workflow Status Baru

### 2.1 Status Enum

Dua status baru telah ditambahkan ke enum `entry_status`:

| Status | Label | Deskripsi | Varian Badge |
| :--- | :--- | :--- | :--- |
| `revisi` | Revisi | Data memerlukan perbaikan dari pemohon | destructive (merah) |
| `selesai_revisi` | Selesai Revisi | Data sudah diperbaiki dan siap diproses | secondary (kuning) |

### 2.2 Status Workflow

Alur status yang diperbarui:

```
belum_lengkap
    ↓
siap_input
    ↓
[Proses Verifikasi]
    ↓
    ├─→ revisi ──→ selesai_revisi ──┐
    │                               ↓
    └─────────────────────────────→ pengajuan
                                    ↓
                              sertifikat_selesai
```

### 2.3 Integrasi Status di Frontend

Status `revisi` dan `selesai_revisi` sudah terintegrasi di:

- **GroupDetail.tsx**: STATUS_CONFIG dengan icon dan varian
- **Dashboard.tsx**: STATUS_LABELS, STATUS_COLORS, STATUS_BG, STATUS_TEXT, STATUS_BADGE_VARIANT
- **TrackingPage.tsx**: STATUS_ORDER dan STATUS_LABEL
- **PublicStats.tsx**: STATUS_CONFIG dengan styling
- **UmkmDashboard.tsx**: Status configuration
- **ProgressTimeline.tsx**: Timeline progression

---

## 3. Hak Akses Granular

### 3.1 Field Access Control

Sistem kontrol akses berbasis role untuk setiap field:

#### Roles yang Dapat Mengakses Field Akun:
- **admin**: can_view=true, can_edit=true
- **lapangan**: can_view=true, can_edit=true
- **nib**: can_view=true, can_edit=true
- **admin_input**: can_view=true, can_edit=true

#### Roles yang Dapat Mengubah Status:
- **admin**: can_view=true, can_edit=true (untuk status:revisi, status:selesai_revisi)
- **owner**: can_view=true, can_edit=true (untuk status:revisi, status:selesai_revisi)
- **admin_input**: can_view=true, can_edit=true (untuk status:revisi, status:selesai_revisi)

### 3.2 Implementasi useFieldAccess Hook

File: `src/hooks/useFieldAccess.ts`

```typescript
export function useFieldAccess(targetRole?: string) {
  const { role } = useAuth();
  const [fields, setFields] = useState<FieldAccess[]>([]);
  const [loading, setLoading] = useState(true);

  const effectiveRole = targetRole || role;
  const isSuperRole = effectiveRole === "super_admin";

  // Super admin dan owner memiliki akses penuh
  // Role lain mengikuti konfigurasi field_access di database
  
  const canView = (field: string) => { /* ... */ };
  const canEdit = (field: string) => { /* ... */ };

  return { fields, loading, canView, canEdit };
}
```

### 3.3 UI Management di AppSettings

File: `src/pages/AppSettings.tsx`

Tab "Hak Akses" memungkinkan super_admin untuk:
- Mengatur permission per role untuk setiap field
- Mengatur permission untuk status transitions
- Menyimpan perubahan ke database

---

## 4. Integrasi Frontend

### 4.1 DataEntryForm Component

File: `src/components/DataEntryForm.tsx`

Penambahan form fields untuk akun baru:

```typescript
const [emailHalal, setEmailHalal] = useState((entry as any)?.email_halal ?? "");
const [sandiHalal, setSandiHalal] = useState((entry as any)?.sandi_halal ?? "");
const [emailNib, setEmailNib] = useState((entry as any)?.email_nib ?? "");
const [sandiNib, setSandiNib] = useState((entry as any)?.sandi_nib ?? "");

// Conditional rendering berdasarkan canEditField()
{canEditField("email_halal") && (
  <div className="space-y-2">
    <Label>Email Halal</Label>
    <Input type="email" value={emailHalal} onChange={(e) => setEmailHalal(e.target.value)} />
  </div>
)}
```

### 4.2 GroupDetail Component

File: `src/pages/GroupDetail.tsx`

- Status change logic dengan granular permissions
- Audit logging untuk setiap perubahan status
- Display field akun di tabel data entries

```typescript
const allowedStatuses = Object.keys(STATUS_CONFIG).filter((s) => canEditField(`status:${s}`));
const canChangeStatus = allowedStatuses.length > 0;
```

### 4.3 Dashboard Component

File: `src/pages/Dashboard.tsx`

- Menampilkan field labels untuk akun baru
- Status colors dan badges untuk revisi dan selesai_revisi
- Field visibility berdasarkan role

---

## 5. Database Permissions (RLS)

### 5.1 Row Level Security

RLS policies memastikan:
- **super_admin**: Akses penuh ke semua data
- **owner**: Akses ke data dalam tenant mereka saja
- **admin, lapangan, nib, admin_input**: Akses ke data dalam grup mereka dengan kontrol field
- **umkm**: Akses read-only ke data mereka sendiri

### 5.2 Field Access Enforcement

Field access dikontrol melalui:
1. **Database level**: RLS policies
2. **Application level**: `useFieldAccess` hook
3. **UI level**: Conditional rendering

---

## 6. Audit Logging

### 6.1 Status Change Tracking

Setiap perubahan status dicatat di tabel `audit_logs`:

```typescript
interface AuditLog {
  id: string;
  entry_id: string;
  entry_name: string | null;
  group_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  changed_at: string;
  changer_name?: string | null;
}
```

### 6.2 Audit Log UI

Ditampilkan di GroupDetail dalam tab "Riwayat Perubahan"

---

## 7. Testing Checklist

- [x] Field akun dapat disimpan dan diambil dari database
- [x] Status revisi dan selesai_revisi dapat diset
- [x] Hak akses field berfungsi dengan benar per role
- [x] Form fields hanya tampil jika user memiliki permission
- [x] Status transitions dicatat di audit log
- [x] Tracking page menampilkan status dengan benar
- [x] Public stats menampilkan distribusi status
- [x] Dashboard menampilkan field labels untuk akun baru

---

## 8. Dokumentasi Pengguna

### 8.1 Untuk Admin

1. **Mengatur Hak Akses**:
   - Buka Settings → Hak Akses
   - Pilih role dan field
   - Centang can_view dan can_edit sesuai kebutuhan
   - Klik Simpan

2. **Mengubah Status ke Revisi**:
   - Buka Group Detail
   - Pilih entry yang perlu revisi
   - Ubah status ke "Revisi"
   - Sistem akan mencatat perubahan di audit log

3. **Memproses Revisi**:
   - Entry akan muncul dengan status "Revisi"
   - Setelah diperbaiki, ubah ke "Selesai Revisi"
   - Lanjutkan proses normal

### 8.2 Untuk Lapangan

- Dapat melihat dan mengedit field akun Halal dan NIB
- Dapat mengubah status entry sesuai dengan permission yang diberikan

---

## 9. Rekomendasi Lanjutan

1. **Enkripsi Password**: Pertimbangkan untuk mengenkripsi field `sandi_halal` dan `sandi_nib` di database untuk keamanan yang lebih baik.

2. **Password Validation**: Tambahkan validasi password strength saat input.

3. **Audit Trail Lengkap**: Catat juga perubahan field akun di audit log untuk tracking yang lebih detail.

4. **Notifikasi**: Implementasikan notifikasi email ketika status berubah ke "Revisi".

5. **Bulk Operations**: Tambahkan fitur untuk mengubah status multiple entries sekaligus.

---

## 10. File yang Dimodifikasi

### Database Migrations
- `supabase/migrations/20260317090000_phase_3_updates.sql`

### TypeScript Types
- `src/integrations/supabase/types.ts` (updated Constants.entry_status)

### Components
- `src/components/DataEntryForm.tsx` (added new fields)
- `src/components/ProgressTimeline.tsx` (added status config)

### Pages
- `src/pages/AppSettings.tsx` (added status options)
- `src/pages/Dashboard.tsx` (added field labels and status colors)
- `src/pages/GroupDetail.tsx` (status management with permissions)
- `src/pages/TrackingPage.tsx` (status order and labels)
- `src/pages/PublicStats.tsx` (status config)
- `src/pages/UmkmDashboard.tsx` (status config)

### Hooks
- `src/hooks/useFieldAccess.ts` (granular permission logic)

---

## 11. Kesimpulan

Fase 3 berhasil mengimplementasikan:
✅ Field akun per data entry (email_halal, sandi_halal, email_nib, sandi_nib)
✅ Workflow status baru (revisi, selesai_revisi)
✅ Hak akses granular berbasis role
✅ Integrasi lengkap ke frontend
✅ Audit logging untuk tracking perubahan

Sistem sekarang siap untuk mengelola proses revisi data dengan kontrol akses yang ketat dan tracking yang komprehensif.

---

**Dokumentasi ini dihasilkan pada**: 17 Maret 2026  
**Versi**: 1.0
