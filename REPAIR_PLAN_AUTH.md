# Rencana Perbaikan: Mengatasi Infinite Loading pada Dashboard

Dokumen ini merinci analisis dan langkah-langkah perbaikan untuk masalah "infinite loading" yang terjadi pada halaman dashboard aplikasi HalalTrack.

## 1. Analisis Akar Masalah

Berdasarkan tangkapan layar, aplikasi tertahan pada layar pemuatan dengan pesan "Memuat data autentikasi...". Hal ini menunjukkan bahwa state `loading` di `AuthContext.tsx` tidak pernah berubah menjadi `false`.

Setelah meninjau kode di `src/contexts/AuthContext.tsx`, ditemukan beberapa potensi penyebab:

| Penyebab Potensial | Penjelasan |
| :--- | :--- |
| **Race Condition** | `onAuthStateChange` dan `initSession` berjalan secara bersamaan. Jika `onAuthStateChange` dipicu sebelum `initSession` selesai, state bisa menjadi tidak sinkron. |
| **Unhandled Errors** | Meskipun sudah ada blok `try...catch`, ada kemungkinan error pada fungsi `fetchRole` atau pemanggilan API Supabase lainnya yang menyebabkan eksekusi terhenti sebelum mencapai `setLoading(false)`. |
| **Supabase Connectivity** | Jika koneksi ke Supabase terhambat atau RLS (Row Level Security) menyebabkan timeout yang sangat lama, `await` pada `getSession()` atau `fetchRole()` mungkin tidak pernah selesai atau memakan waktu terlalu lama. |
| **Double Initialization** | Penggunaan `initialized.current` dimaksudkan untuk mencegah inisialisasi ganda, namun logika di dalam `useEffect` mungkin masih memicu pembaruan state yang saling bertabrakan. |

## 2. Rencana Perbaikan (Action Plan)

### Fase 1: Penguatan `AuthContext.tsx` (Prioritas Utama)
Kita akan merombak logika inisialisasi untuk memastikan state `loading` selalu dihentikan, apapun hasilnya.

1.  **Gunakan Timeout Global:** Tambahkan `setTimeout` sebagai pengaman terakhir (failsafe) yang akan memaksa `loading` menjadi `false` setelah 10 detik jika proses inisialisasi belum selesai.
2.  **Konsolidasi Inisialisasi:** Pastikan `initSession` dan `onAuthStateChange` tidak saling tumpang tindih dalam memperbarui state loading.
3.  **Peningkatan Logging:** Tambahkan log yang lebih detail untuk melacak di tahap mana proses autentikasi terhenti.

### Fase 2: Optimasi Pengambilan Role
Fungsi `fetchRole` akan diperbaiki agar lebih tahan banting:
*   Jika query ke `user_roles` atau `profiles` gagal, jangan biarkan proses utama berhenti.
*   Gunakan nilai default jika data tidak ditemukan.

### Fase 3: Penanganan di Sisi UI
*   Tambahkan tombol "Muat Ulang" atau "Logout" pada layar loading jika proses memakan waktu lebih dari 15 detik, sehingga pengguna tidak terjebak.

## 3. Langkah Implementasi Teknis

```typescript
// Contoh perbaikan pada initSession di AuthContext.tsx
const initSession = async () => {
  const timeoutId = setTimeout(() => {
    if (loading) {
      console.warn("Auth initialization timed out. Forcing loading to false.");
      setLoading(false);
    }
  }, 10000); // 10 detik timeout

  try {
    // ... logika getSession ...
  } finally {
    clearTimeout(timeoutId);
    setLoading(false);
    initialized.current = true;
  }
};
```

## 4. Verifikasi

Setelah perbaikan diterapkan:
1.  Buka Dashboard dan pastikan halaman muncul dalam < 3 detik.
2.  Uji dengan koneksi internet lambat untuk memastikan failsafe berfungsi.
3.  Periksa konsol browser untuk memastikan tidak ada error RLS atau timeout yang tidak tertangani.
