import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { hariIni, formatTanggal } from '../lib/format'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import { Users, UtensilsCrossed, AlertTriangle, Clock } from 'lucide-react'

export default function Dashboard() {
  const { role, profile } = useAuth()
  const [stats, setStats] = useState(null)
  const [kebutuhanDiet, setKebutuhanDiet] = useState([])
  const [statusBangsal, setStatusBangsal] = useState([])
  const [nearExpiry, setNearExpiry] = useState([])
  const [stokRendah, setStokRendah] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      const today = hariIni()

      // Pasien aktif
      const { count: totalPasien } = await supabase
        .from('pasien')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'aktif')

      // Total porsi hari ini
      const { count: totalPorsi } = await supabase
        .from('pesanan_makan')
        .select('*', { count: 'exact', head: true })
        .eq('tanggal', today)
        .neq('status', 'dibatalkan')

      // Bahan di bawah stok minimum
      const { data: stokBahan } = await supabase
        .from('v_stok_bahan')
        .select('*')
      const rendah = (stokBahan || []).filter(b => b.stok_total < b.stok_minimum)

      // Near expiry
      const { data: expiry } = await supabase
        .from('v_near_expiry')
        .select('*')
        .order('tgl_kedaluwarsa')

      setStats({
        totalPasien: totalPasien || 0,
        totalPorsi: totalPorsi || 0,
        stokRendah: rendah.length,
        nearExpiry: (expiry || []).length,
      })
      setStokRendah(rendah)
      setNearExpiry(expiry || [])

      // Kebutuhan diet hari ini
      const { data: diet } = await supabase
        .from('v_kebutuhan_diet')
        .select('*')
        .eq('tanggal', today)
        .order('waktu_makan')
      setKebutuhanDiet(diet || [])

      // Status bangsal hari ini
      const { data: bangsal } = await supabase
        .from('v_status_bangsal')
        .select('*')
        .eq('tanggal', today)
        .order('waktu_makan')
      setStatusBangsal(bangsal || [])
    } catch (err) {
      console.error('Gagal muat dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800">
        Dashboard
      </h2>

      {/* Kartu ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pasien Aktif" value={stats.totalPasien} icon={Users} color="emerald" />
        <StatCard label="Porsi Hari Ini" value={stats.totalPorsi} icon={UtensilsCrossed} color="blue" />
        <StatCard label="Stok Menipis" value={stats.stokRendah} icon={AlertTriangle} color={stats.stokRendah > 0 ? 'red' : 'emerald'} />
        <StatCard label="Hampir Kedaluwarsa" value={stats.nearExpiry} icon={Clock} color={stats.nearExpiry > 0 ? 'yellow' : 'emerald'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kebutuhan diet hari ini */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Kebutuhan Diet Hari Ini</h3>
          {kebutuhanDiet.length === 0 ? (
            <EmptyState message="Belum ada data pesanan hari ini" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-3 py-2 text-xs text-gray-500">Waktu</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500">Diet</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {kebutuhanDiet.map((d, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="px-3 py-2 capitalize">{d.waktu_makan}</td>
                      <td className="px-3 py-2">{d.diet}</td>
                      <td className="px-3 py-2 text-right font-medium">{d.jumlah}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Status per bangsal */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Status Penyiapan per Bangsal</h3>
          {statusBangsal.length === 0 ? (
            <EmptyState message="Belum ada data status bangsal" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-3 py-2 text-xs text-gray-500">Waktu</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500">Bangsal</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500">Status</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {statusBangsal.map((s, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="px-3 py-2 capitalize">{s.waktu_makan}</td>
                      <td className="px-3 py-2">{s.bangsal}</td>
                      <td className="px-3 py-2">
                        <Badge color={s.status}>{s.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{s.jumlah}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Alert panel */}
      {(nearExpiry.length > 0 || stokRendah.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {nearExpiry.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <h3 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                <Clock size={16} /> Hampir Kedaluwarsa
              </h3>
              <ul className="space-y-1 text-sm text-yellow-700">
                {nearExpiry.slice(0, 5).map(e => (
                  <li key={e.batch_id}>
                    {e.bahan} — {e.jumlah_sisa} {e.satuan} — {e.sisa_hari} hari lagi ({formatTanggal(e.tgl_kedaluwarsa)})
                  </li>
                ))}
                {nearExpiry.length > 5 && (
                  <li className="text-xs">...dan {nearExpiry.length - 5} lainnya</li>
                )}
              </ul>
            </div>
          )}

          {stokRendah.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                <AlertTriangle size={16} /> Stok di Bawah Minimum
              </h3>
              <ul className="space-y-1 text-sm text-red-700">
                {stokRendah.map(b => (
                  <li key={b.id}>
                    {b.nama} — sisa {b.stok_total} {b.satuan} (min. {b.stok_minimum})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

