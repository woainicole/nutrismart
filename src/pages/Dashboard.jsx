import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNotifikasi } from '../context/NotifikasiContext'
import { supabase } from '../lib/supabaseClient'
import { hariIni, formatTanggal } from '../lib/format'
import { useNavigate } from 'react-router-dom'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import { Users, UtensilsCrossed, AlertTriangle, Clock, RefreshCw, Bell, ChevronRight, TrendingUp } from 'lucide-react'

const ROLE_LABEL = { admin: 'Admin', ahli_gizi: 'Ahli Gizi', koki: 'Koki', perawat: 'Perawat', gudang: 'Gudang' }

function greeting() {
  const h = new Date().getHours()
  if (h < 11) return 'Selamat Pagi'
  if (h < 15) return 'Selamat Siang'
  return 'Selamat Sore'
}

export default function Dashboard() {
  const { role, profile } = useAuth()
  const { notifs } = useNotifikasi()
  const navigate = useNavigate()

  const [stats, setStats] = useState(null)
  const [kebutuhanDiet, setKebutuhanDiet] = useState([])
  const [nearExpiry, setNearExpiry] = useState([])
  const [rendah, setRendah] = useState([])
  const [sesi, setSesi] = useState([])
  const [pasienPerhatian, setPasienPerhatian] = useState([])
  const [loading, setLoading] = useState(true)

  const tanggalLengkap = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  const loadDashboard = useCallback(async () => {
    try {
      const today = hariIni()

      const [
        { count: totalPasien },
        { count: totalPorsi },
        { count: terkirim },
        { data: stokBahan },
        { data: expiry },
        { data: diet },
        { data: sesiData },
      ] = await Promise.all([
        supabase.from('pasien').select('*', { count: 'exact', head: true }).eq('status', 'aktif'),
        supabase.from('pesanan_makan').select('*', { count: 'exact', head: true }).eq('tanggal', today).neq('status', 'dibatalkan'),
        supabase.from('pesanan_makan').select('*', { count: 'exact', head: true }).eq('tanggal', today).eq('status', 'terkirim'),
        supabase.from('v_stok_bahan').select('*'),
        supabase.from('v_near_expiry').select('*').order('tgl_kedaluwarsa'),
        supabase.from('v_kebutuhan_diet').select('*').eq('tanggal', today).order('waktu_makan'),
        supabase.from('sesi_makan').select('*').eq('tanggal', today).order('waktu_makan'),
      ])

      const rendahList = (stokBahan || []).filter(b => Number(b.stok_total) < Number(b.stok_minimum))
      const expiryList = expiry || []

      let perhatianList = []
      try {
        const { data: pp } = await supabase.from('v_pasien_perhatian').select('*').limit(5)
        perhatianList = pp || []
      } catch {}

      const totalPorsiN = totalPorsi || 0
      const terkirimN = terkirim || 0
      const progresKirim = totalPorsiN > 0 ? Math.round(terkirimN / totalPorsiN * 100) : 0

      setStats({
        totalPasien: totalPasien || 0,
        totalPorsi: totalPorsiN,
        progresKirim,
        totalPeringatan: rendahList.length + expiryList.length + perhatianList.length,
      })
      setRendah(rendahList)
      setNearExpiry(expiryList)
      setKebutuhanDiet(diet || [])
      setSesi(sesiData || [])
      setPasienPerhatian(perhatianList)
    } catch (err) {
      console.error('Gagal muat dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
    const timer = setInterval(loadDashboard, 60_000)
    return () => clearInterval(timer)
  }, [loadDashboard])

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{greeting()}, {profile?.nama?.split(' ')[0]}!</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {tanggalLengkap} · <span className="font-medium text-emerald-700">{ROLE_LABEL[role]}</span>
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); loadDashboard() }}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
        >
          <RefreshCw size={14} /> Segarkan
        </button>
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pasien Aktif" value={stats.totalPasien} icon={Users} color="emerald" />
        <StatCard label="Porsi Hari Ini" value={stats.totalPorsi} icon={UtensilsCrossed} color="blue" />
        <StatCard
          label="Progres Terkirim"
          value={`${stats.progresKirim}%`}
          icon={TrendingUp}
          color={stats.progresKirim >= 80 ? 'emerald' : 'yellow'}
        />
        <StatCard
          label="Peringatan"
          value={stats.totalPeringatan}
          icon={AlertTriangle}
          color={stats.totalPeringatan > 0 ? 'red' : 'emerald'}
        />
      </div>

      {/* 3 Sesi cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {['pagi', 'siang', 'malam'].map(sesiName => {
          const s = sesi.find(x => x.waktu_makan === sesiName)
          return (
            <div key={sesiName} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-700 capitalize">{sesiName}</h3>
                {s?.aktif
                  ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Aktif</span>
                  : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Tidak Aktif</span>
                }
              </div>
              {s ? (
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between"><span>Disiapkan</span><span className="font-medium">{s.n_disiapkan ?? 0}</span></div>
                  <div className="flex justify-between"><span>Siap</span><span className="font-medium">{s.n_siap ?? 0}</span></div>
                  <div className="flex justify-between"><span>Terkirim</span><span className="font-medium text-emerald-600">{s.n_terkirim ?? 0}</span></div>
                </div>
              ) : (
                <p className="text-xs text-gray-400">Belum diaktifkan</p>
              )}
              {['koki', 'admin'].includes(role) && (
                <button
                  onClick={() => navigate('/pesanan')}
                  className="mt-3 text-xs text-emerald-600 hover:underline flex items-center gap-1"
                >
                  Buka Pesanan <ChevronRight size={12} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Grid 2 col */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kebutuhan diet */}
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

        {/* Alert panel */}
        <div className="space-y-3">
          {nearExpiry.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <h3 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                <Clock size={15} /> Hampir Kedaluwarsa ({nearExpiry.length})
              </h3>
              <ul className="text-sm text-yellow-700 space-y-1">
                {nearExpiry.slice(0, 4).map((e, i) => (
                  <li key={i}>{e.bahan} — {e.jumlah_sisa} {e.satuan} ({e.sisa_hari} hari lagi)</li>
                ))}
                {nearExpiry.length > 4 && <li className="text-xs">...{nearExpiry.length - 4} lainnya</li>}
              </ul>
            </div>
          )}
          {rendah.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                <AlertTriangle size={15} /> Stok Menipis ({rendah.length})
              </h3>
              <ul className="text-sm text-red-700 space-y-1">
                {rendah.slice(0, 4).map(b => (
                  <li key={b.id}>{b.nama} — sisa {b.stok_total} {b.satuan} (min. {b.stok_minimum})</li>
                ))}
                {rendah.length > 4 && <li className="text-xs">...{rendah.length - 4} lainnya</li>}
              </ul>
            </div>
          )}
          {pasienPerhatian.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <h3 className="font-semibold text-orange-800 mb-2">
                Pasien Perlu Perhatian ({pasienPerhatian.length})
              </h3>
              <ul className="text-sm text-orange-700 space-y-1">
                {pasienPerhatian.slice(0, 3).map((p, i) => (
                  <li key={i}>{p.nama_pasien} — rata sisa {p.avg_sisa}%</li>
                ))}
              </ul>
            </div>
          )}
          {nearExpiry.length === 0 && rendah.length === 0 && pasienPerhatian.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-sm text-green-700 text-center">
              ✓ Tidak ada peringatan hari ini
            </div>
          )}
        </div>
      </div>

      {/* Aktivitas terbaru */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Bell size={15} /> Aktivitas Terbaru
        </h3>
        {notifs.length === 0 ? (
          <p className="text-sm text-gray-400">Belum ada aktivitas</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {notifs.slice(0, 5).map(n => (
              <li key={n.id} className="py-2 text-sm text-gray-700 flex gap-2">
                <span className="text-gray-400 text-xs mt-0.5 shrink-0">
                  {n.created_at?.slice(11, 16)}
                </span>
                <span>{n.pesan}</span>
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={() => navigate('/notifikasi')}
          className="mt-2 text-xs text-emerald-600 hover:underline"
        >
          Lihat semua →
        </button>
      </div>
    </div>
  )
}
