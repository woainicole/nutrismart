const COLORS = {
  // Status pesanan
  menunggu: 'bg-gray-100 text-gray-700',
  disiapkan: 'bg-blue-100 text-blue-700',
  siap: 'bg-yellow-100 text-yellow-700',
  terkirim: 'bg-green-100 text-green-700',
  dibatalkan: 'bg-red-100 text-red-700',
  // Status pengajuan
  disetujui: 'bg-green-100 text-green-700',
  ditolak: 'bg-red-100 text-red-700',
  diterima: 'bg-emerald-100 text-emerald-700',
  // Stok
  aman: 'bg-green-100 text-green-700',
  menipis: 'bg-yellow-100 text-yellow-700',
  habis: 'bg-red-100 text-red-700',
  // Generic
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-yellow-100 text-yellow-700',
  success: 'bg-green-100 text-green-700',
  danger: 'bg-red-100 text-red-700',
}

export default function Badge({ children, color = 'info' }) {
  const cls = COLORS[color] || COLORS.info
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {children}
    </span>
  )
}

