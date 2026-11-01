// Helper format tanggal, angka, persen — locale id-ID

// Tampilkan tanggal: "31 Okt 2026"
export function formatTanggal(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// Tampilkan tanggal lengkap: "Sabtu, 31 Oktober 2026"
export function formatTanggalLengkap(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// Tanggal "hari ini" di zona Asia/Jakarta, format YYYY-MM-DD (untuk kirim ke DB)
export function hariIni() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })
}

// Format angka: 1234.5 → "1.234,5"
export function formatAngka(n) {
  if (n == null) return '-'
  return new Intl.NumberFormat('id-ID').format(n)
}

// Format persen: 75 → "75%"
export function formatPersen(n) {
  if (n == null) return '-'
  return `${n}%`
}

