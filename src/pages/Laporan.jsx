import { useState } from 'react'
import { getLaporanDistribusi, getLaporanFoodWaste, getLaporanPemakaian } from '../services/laporanService'
import { hariIni, formatTanggal } from '../lib/format'
import { exportCsv } from '../lib/exportCsv'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import DataTable from '../components/ui/DataTable'
import toast from 'react-hot-toast'
import { Download, Printer } from 'lucide-react'

// Column definitions per tab
const COLUMNS = {
  distribusi: [
    { key: 'tanggal',     label: 'Tanggal',  render: r => formatTanggal(r.tanggal) },
    { key: 'waktu_makan', label: 'Waktu',    render: r => <span className="capitalize">{r.waktu_makan}</span> },
    { key: 'bangsal',     label: 'Bangsal',  render: r => r.pasien?.bangsal?.nama ?? '-' },
    { key: 'status',      label: 'Status',   render: r => <Badge color={r.status}>{r.status}</Badge> },
  ],
  foodwaste: [
    { key: 'tanggal',     label: 'Tanggal',  render: r => formatTanggal(r.tanggal) },
    { key: 'waktu_makan', label: 'Waktu',    render: r => <span className="capitalize">{r.waktu_makan}</span> },
    { key: 'bangsal',     label: 'Bangsal',  render: r => r.bangsal ?? '-' },
    { key: 'menu',        label: 'Menu',     render: r => r.menu ?? '-' },
    { key: 'diet',        label: 'Diet',     render: r => r.diet ?? '-' },
    { key: 'persen_sisa', label: '% Sisa',   render: r => `${r.persen_sisa}%` },
    { key: 'alasan',      label: 'Alasan',   render: r => r.alasan },
  ],
  pemakaian: [
    { key: 'tanggal',     label: 'Tanggal',  render: r => formatTanggal(r.tanggal) },
    { key: 'bahan',       label: 'Bahan',    render: r => r.bahan?.nama },
    { key: 'jumlah',      label: 'Jumlah',   render: r => <span className="text-right block">{r.jumlah}</span> },
    { key: 'satuan',      label: 'Satuan',   render: r => r.bahan?.satuan },
  ],
}

// Plain <tr> renderers for the print-only full table
function PrintRows({ tab, data }) {
  if (tab === 'distribusi') {
    return data.map((r, i) => (
      <tr key={i} className="border-b border-gray-100">
        <td className="px-4 py-2">{formatTanggal(r.tanggal)}</td>
        <td className="px-4 py-2 capitalize">{r.waktu_makan}</td>
        <td className="px-4 py-2">{r.pasien?.bangsal?.nama ?? '-'}</td>
        <td className="px-4 py-2">{r.status}</td>
      </tr>
    ))
  }
  if (tab === 'foodwaste') {
    return data.map((r, i) => (
      <tr key={i} className="border-b border-gray-100">
        <td className="px-4 py-2">{formatTanggal(r.tanggal)}</td>
        <td className="px-4 py-2 capitalize">{r.waktu_makan}</td>
        <td className="px-4 py-2">{r.bangsal ?? '-'}</td>
        <td className="px-4 py-2">{r.menu ?? '-'}</td>
        <td className="px-4 py-2">{r.diet ?? '-'}</td>
        <td className="px-4 py-2">{r.persen_sisa}%</td>
        <td className="px-4 py-2">{r.alasan}</td>
      </tr>
    ))
  }
  // pemakaian
  return data.map((r, i) => (
    <tr key={i} className="border-b border-gray-100">
      <td className="px-4 py-2">{formatTanggal(r.tanggal)}</td>
      <td className="px-4 py-2">{r.bahan?.nama}</td>
      <td className="px-4 py-2 text-right">{r.jumlah}</td>
      <td className="px-4 py-2">{r.bahan?.satuan}</td>
    </tr>
  ))
}

export default function Laporan() {
  const [tab, setTab] = useState('distribusi')
  const [tglMulai, setTglMulai] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7)
    return d.toISOString().slice(0, 10)
  })
  const [tglSelesai, setTglSelesai] = useState(hariIni())
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [printing, setPrinting] = useState(false)

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

  function handlePrint() {
    setPrinting(true)
    window.onafterprint = () => {
      setPrinting(false)
      window.onafterprint = null
    }
    setTimeout(() => { window.print() }, 100)
  }

  // Summary line per tab
  function Summary() {
    if (data.length === 0) return null
    if (tab === 'distribusi') {
      return (
        <p className="text-sm text-gray-600 mb-2">
          Total: <span className="font-medium">{data.length}</span> pesanan
        </p>
      )
    }
    if (tab === 'foodwaste') {
      const avg = data.length
        ? (data.reduce((s, r) => s + (r.persen_sisa || 0), 0) / data.length).toFixed(1)
        : 0
      return (
        <p className="text-sm text-gray-600 mb-2">
          Total: <span className="font-medium">{data.length}</span> catatan
          {' '}| Rata-rata sisa: <span className="font-medium">{avg}%</span>
        </p>
      )
    }
    // pemakaian
    return (
      <p className="text-sm text-gray-600 mb-2">
        Total: <span className="font-medium">{data.length}</span> pemakaian
      </p>
    )
  }

  const columns = COLUMNS[tab]

  // Print-table header cells per tab
  const printHeaders = {
    distribusi: ['Tanggal', 'Waktu', 'Bangsal', 'Status'],
    foodwaste:  ['Tanggal', 'Waktu', 'Bangsal', 'Menu', 'Diet', '% Sisa', 'Alasan'],
    pemakaian:  ['Tanggal', 'Bahan', 'Jumlah', 'Satuan'],
  }

  return (
    <div>
      <PageHeader title="Laporan" />

      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { key: 'distribusi', label: 'Distribusi Makanan' },
          { key: 'foodwaste',  label: 'Food Waste' },
          { key: 'pemakaian',  label: 'Pemakaian Bahan' },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setData([]) }}
            className={`px-4 py-2 text-sm rounded-lg font-medium ${tab === t.key ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4 print:hidden">
        <input type="date" value={tglMulai} onChange={e => setTglMulai(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <span className="text-gray-400">s/d</span>
        <input type="date" value={tglSelesai} onChange={e => setTglSelesai(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <Button onClick={load}>Tampilkan</Button>
        <Button variant="secondary" onClick={handleExport}><Download size={16} /> CSV</Button>
        <Button variant="secondary" onClick={handlePrint}><Printer size={16} /> Cetak</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <>
          <Summary />

          {/* Print-only full table (no pagination) */}
          {printing && data.length > 0 && (
            <div className="hidden print:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {printHeaders[tab].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <PrintRows tab={tab} data={data} />
                </tbody>
              </table>
            </div>
          )}

          {/* Normal paginated view */}
          <div className="print:hidden">
            {data.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200">
                <EmptyState message="Klik Tampilkan untuk memuat data" />
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={data}
                searchKeys={[]}
                pageSize={25}
                pageSizeOptions={[10, 25, 50, 100]}
                loading={false}
                emptyMessage="Tidak ada data"
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
