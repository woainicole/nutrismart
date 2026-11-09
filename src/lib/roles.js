// Definisi role, menu sidebar, dan helper akses

export const ROLE = {
  ADMIN: 'admin',
  AHLI_GIZI: 'ahli_gizi',
  KOKI: 'koki',
  PERAWAT: 'perawat',
  GUDANG: 'gudang',
}

// Label tampilan per role
export const ROLE_LABEL = {
  admin: 'Admin',
  ahli_gizi: 'Ahli Gizi',
  koki: 'Koki',
  perawat: 'Perawat',
  gudang: 'Gudang',
}

// Menu sidebar: setiap item punya path, label, ikon (lucide), dan daftar role yang boleh akses
// "lihat" = bisa buka halaman tapi tombol CUD disembunyikan, ditangani di komponen
export const MENU_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard', allow: ['admin','ahli_gizi','koki','perawat','gudang'] },
  { path: '/pasien', label: 'Pasien', icon: 'Users', allow: ['admin','ahli_gizi','perawat'] },
  { path: '/diet', label: 'Jenis Diet', icon: 'Apple', allow: ['admin','ahli_gizi','koki','perawat'] },
  { path: '/menu', label: 'Menu & Resep', icon: 'UtensilsCrossed', allow: ['admin','ahli_gizi','koki'] },
  { path: '/bahan', label: 'Bahan & Supplier', icon: 'Package', allow: ['admin','ahli_gizi','koki','gudang'] },
  { path: '/bangsal', label: 'Bangsal', icon: 'Building2', allow: ['admin'] },
  { path: '/stok', label: 'Stok', icon: 'Warehouse', allow: ['admin','ahli_gizi','koki','gudang'] },
  { path: '/menu-harian', label: 'Menu Harian', icon: 'CalendarDays', allow: ['admin','ahli_gizi','koki'] },
  { path: '/pesanan', label: 'Pesanan Makan', icon: 'ClipboardList', allow: ['admin','ahli_gizi','koki','perawat'] },
  { path: '/pengajuan-diet', label: 'Pengajuan Diet', icon: 'FileText', allow: ['admin','ahli_gizi','perawat'] },
  { path: '/pengajuan-pembelian', label: 'Pengajuan Pembelian', icon: 'ShoppingCart', allow: ['admin','koki','gudang'] },
  { path: '/pengembalian', label: 'Pengembalian', icon: 'RotateCcw', allow: ['admin','ahli_gizi','koki','perawat'] },
  { path: '/riwayat-makan', label: 'Riwayat Makan', icon: 'ClipboardCheck', allow: ['admin','ahli_gizi','perawat'] },
  { path: '/laporan', label: 'Laporan', icon: 'FileBarChart', allow: ['admin','ahli_gizi','koki','gudang'] },
  { path: '/grafik', label: 'Grafik', icon: 'BarChart3', allow: ['admin','ahli_gizi','koki','gudang'] },
  { path: '/notifikasi', label: 'Notifikasi', icon: 'Bell', allow: ['admin','ahli_gizi','koki','perawat','gudang'] },
  { path: '/log-aktivitas', label: 'Log Aktivitas', icon: 'Activity', allow: ['admin'] },
  { path: '/pengaturan', label: 'Pengaturan', icon: 'Settings', allow: ['admin'] },
  { path: '/profil', label: 'Profil', icon: 'UserCircle', allow: ['admin','ahli_gizi','koki','perawat','gudang'] },
]

// Role yang hanya boleh "lihat" (tanpa tombol CUD) per halaman
export const VIEW_ONLY = {
  '/pasien': ['perawat'],
  '/diet': ['koki', 'perawat'],
  '/menu': ['koki'],
  '/bahan': ['ahli_gizi', 'koki'],
  '/stok': ['ahli_gizi', 'koki'],
  '/menu-harian': ['koki'],
  '/pesanan': ['perawat'],
  '/riwayat-makan': ['perawat'],
}

// Cek apakah role boleh mengakses path
export function canAccess(role, path) {
  const item = MENU_ITEMS.find(m => m.path === path)
  if (!item) return true // halaman tanpa batasan (misal /profil)
  return item.allow.includes(role)
}

// Cek apakah role hanya boleh lihat (tanpa CUD)
export function isViewOnly(role, path) {
  const viewers = VIEW_ONLY[path]
  return viewers ? viewers.includes(role) : false
}

