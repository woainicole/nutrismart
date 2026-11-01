import { useState } from 'react'
import { getLaporanDistribusi, getLaporanFoodWaste, getLaporanPemakaian } from '../services/laporanService'
import { hariIni, formatTanggal } from '../lib/format'
import { exportCsv } from '../lib/exportCsv'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import toast from 'react-hot-toast'
import { Download, Printer } from 'lucide-react'

export default function Laporan() {
  const [tab, setTab] = useState('distribusi')
  const [tglMulai, setTglMulai] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7)
    return d.toISOString().slice(0, 10)
  })
  const [tglSelesai, setTglSelesai] = useState(hariIni())
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      if (tab === 'distribusi') setData(await getLaporanDistribusi(tglMulai, tglSelesai))
      else if (tab === 'foodwaste') setData(await getLaporanFoodWaste(tglMulai, tglSelesai))
      else setData(await getLaporanPemakaian(tglMulai, tglSelesai))
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  function handleExport() {
    if (data.length === 0) return toast.error('Tidak ada data untuk diekspor')
    if (tab === 'distribusi') {
      // Group: tanggal, waktu, bangsal, status → jumlah
      const grouped = {}
      data.forEach(r => {
        const key = `${r.tanggal}|${r.waktu_makan}|${r.pasien?.bangsal?.nama || '-'}|${r.status}`
        grouped[key] = (grouped[key] || 0) + 1
      })
      const rows = Object.entries(grouped).map(([k, v]) => [...k.split('|'), v])
      exportCsv('laporan-distribusi.csv', ['Tanggal', 'Waktu', 'Bangsal', 'Status', 'Jumlah'], rows)
    } else if (tab === 'foodwaste') {
      const rows = data.map(r => [r.tanggal, r.waktu_makan, r.bangsal, r.menu, r.diet, r.persen_sisa, r.alasan])
      exportCsv('laporan-foodwaste.csv', ['Tanggal', 'Waktu', 'Bangsal', 'Menu', 'Diet', '% Sisa', 'Alasan'], rows)
    } else {
      const rows = data.map(r => [r.tanggal, r.bahan?.nama, r.jumlah, r.bahan?.satuan])
      exportCsv('laporan-pemakaian.csv', ['Tanggal', 'Bahan', 'Jumlah', 'Satuan'], rows)
    }
    toast.success('CSV berhasil diunduh')
  }

  return (
    <div>
      <PageHeader title="Laporan" />

      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { key: 'distribusi', label: 'Distribusi Makanan' },
          { key: 'foodwaste', label: 'Food Waste' },
          { key: 'pemakaian', label: 'Pemakaian Bahan' },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setData([]) }}
            className={`px-4 py-2 text-sm rounded-lg font-medium ${tab === t.key ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input type="date" value={tglMulai} onChange={e => setTglMulai(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <span className="text-gray-400">s/d</span>
        <input type="date" value={tglSelesai} onChange={e => setTglSelesai(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <Button onClick={load}>Tampilkan</Button>
        <Button variant="secondary" onClick={handleExport}><Download size={16} /> CSV</Button>
        <Button variant="secondary" onClick={() => window.print()}><Printer size={16} /> Cetak</Button>
      </div>

      {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto print:border-0 print:shadow-none">
          {data.length === 0 ? <EmptyState message="Klik Tampilkan untuk memuat data" /> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {tab === 'distribusi' && <><th className="px-4 py-3 text-left text-xs text-gray-500">Tanggal</th><th className="px-4 py-3 text-left text-xs text-gray-500">Waktu</th><th className="px-4 py-3 text-left text-xs text-gray-500">Bangsal</th><th className="px-4 py-3 text-left text-xs text-gray-500">Status</th></>}
                  {tab === 'foodwaste' && <><th className="px-4 py-3 text-left text-xs text-gray-500">Tanggal</th><th className="px-4 py-3 text-left text-xs text-gray-500">Waktu</th><th className="px-4 py-3 text-left text-xs text-gray-500">Bangsal</th><th className="px-4 py-3 text-left text-xs text-gray-500">Menu</th><th className="px-4 py-3 text-left text-xs text-gray-500">Diet</th><th className="px-4 py-3 text-left text-xs text-gray-500">% Sisa</th><th className="px-4 py-3 text-left text-xs text-gray-500">Alasan</th></>}
                  {tab === 'pemakaian' && <><th className="px-4 py-3 text-left text-xs text-gray-500">Tanggal</th><th className="px-4 py-3 text-left text-xs text-gray-500">Bahan</th><th className="px-4 py-3 text-right text-xs text-gray-500">Jumlah</th><th className="px-4 py-3 text-left text-xs text-gray-500">Satuan</th></>}
                </tr>
              </thead>
              <tbody>
                {tab === 'distribusi' && data.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-4 py-2">{formatTanggal(r.tanggal)}</td>
                    <td className="px-4 py-2 capitalize">{r.waktu_makan}</td>
                    <td className="px-4 py-2">{r.pasien?.bangsal?.nama ?? '-'}</td>
                    <td className="px-4 py-2"><Badge color={r.status}>{r.status}</Badge></td>
                  </tr>
                ))}
                {tab === 'foodwaste' && data.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-4 py-2">{formatTanggal(r.tanggal)}</td>
                    <td className="px-4 py-2 capitalize">{r.waktu_makan}</td>
                    <td className="px-4 py-2">{r.bangsal ?? '-'}</td>
                    <td className="px-4 py-2">{r.menu ?? '-'}</td>
                    <td className="px-4 py-2">{r.diet ?? '-'}</td>
                    <td className="px-4 py-2">{r.persen_sisa}%</td>
                    <td className="px-4 py-2">{r.alasan}</td>
                  </tr>
                ))}
                {tab === 'pemakaian' && data.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-4 py-2">{formatTanggal(r.tanggal)}</td>
                    <td className="px-4 py-2">{r.bahan?.nama}</td>
                    <td className="px-4 py-2 text-right">{r.jumlah}</td>
                    <td className="px-4 py-2">{r.bahan?.satuan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

