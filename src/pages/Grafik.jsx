import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { hariIni } from '../lib/format'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import DataTable from '../components/ui/DataTable'
import Badge from '../components/ui/Badge'
import toast from 'react-hot-toast'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement } from 'chart.js'
import { Doughnut, Bar, Line } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement)

const COLORS = ['#059669','#0284c7','#d97706','#dc2626','#7c3aed','#db2777','#0891b2','#65a30d']

export default function Grafik() {
  const [tab, setTab] = useState('foodwaste')
  const [tglMulai, setTglMulai] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) })
  const [tglSelesai, setTglSelesai] = useState(hariIni())
  const [chartData, setChartData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [evaluasiData, setEvaluasiData] = useState([])

  async function load() {
    setLoading(true)
    try {
      if (tab === 'foodwaste') await loadFoodWaste()
      else if (tab === 'diet') await loadDiet()
      else if (tab === 'evaluasi') await loadEvaluasi()
      else await loadBahan()
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  async function loadFoodWaste() {
    const { data, error } = await supabase.from('v_food_waste').select('tanggal, persen_sisa').gte('tanggal', tglMulai).lte('tanggal', tglSelesai).order('tanggal')
    if (error) throw error
    // Group per tanggal → rata-rata persen_sisa
    const grouped = {}
    for (const r of data) {
      if (!grouped[r.tanggal]) grouped[r.tanggal] = []
      grouped[r.tanggal].push(r.persen_sisa)
    }
    const labels = Object.keys(grouped).sort()
    const values = labels.map(d => {
      const arr = grouped[d]
      return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
    })
    setChartData({
      labels,
      datasets: [{ label: 'Rata-rata % Sisa', data: values, borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.1)', fill: true, tension: 0.3 }],
    })
  }

  async function loadDiet() {
    const { data, error } = await supabase.from('pasien').select('jenis_diet_id, diet:jenis_diet(nama)').eq('status', 'aktif')
    if (error) throw error
    const counts = {}
    for (const r of data) {
      const name = r.diet?.nama ?? 'Tanpa Diet'
      counts[name] = (counts[name] || 0) + 1
    }
    const labels = Object.keys(counts)
    setChartData({
      labels,
      datasets: [{ data: labels.map(l => counts[l]), backgroundColor: COLORS.slice(0, labels.length) }],
    })
  }

  async function loadBahan() {
    const { data, error } = await supabase.from('pemakaian_bahan').select('bahan_id, jumlah, bahan:bahan_makanan(nama)').gte('tanggal', tglMulai).lte('tanggal', tglSelesai)
    if (error) throw error
    const totals = {}
    for (const r of data) {
      const name = r.bahan?.nama ?? `Bahan ${r.bahan_id}`
      totals[name] = (totals[name] || 0) + Number(r.jumlah)
    }
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 10)
    setChartData({
      labels: sorted.map(s => s[0]),
      datasets: [{ label: 'Total Pemakaian', data: sorted.map(s => s[1]), backgroundColor: '#059669' }],
    })
  }

  async function loadEvaluasi() {
    const { data, error } = await supabase
      .from('v_food_waste')
      .select('menu, persen_sisa, alasan')
      .gte('tanggal', tglMulai)
      .lte('tanggal', tglSelesai)
    if (error) throw error
    // Grup per menu
    const grouped = {}
    for (const r of data) {
      if (!grouped[r.menu]) grouped[r.menu] = { total: 0, sisa: [], alasan: {} }
      grouped[r.menu].total++
      grouped[r.menu].sisa.push(r.persen_sisa || 0)
      if (r.alasan) grouped[r.menu].alasan[r.alasan] = (grouped[r.menu].alasan[r.alasan] || 0) + 1
    }
    const rows = Object.entries(grouped).map(([menu, v]) => ({
      menu,
      jumlah: v.total,
      avg_sisa: Math.round(v.sisa.reduce((a, b) => a + b, 0) / v.sisa.length),
      alasan_top: Object.entries(v.alasan).sort((a, b) => b[1] - a[1])[0]?.[0] || '—',
      perlu_evaluasi: v.total >= 5 && Math.round(v.sisa.reduce((a, b) => a + b, 0) / v.sisa.length) >= 40,
    })).sort((a, b) => b.avg_sisa - a.avg_sisa)
    setEvaluasiData(rows)
    // Set chart: top 10 horizontal bar
    const top10 = rows.slice(0, 10)
    setChartData({
      labels: top10.map(r => r.menu),
      datasets: [{ label: 'Rata-rata % Sisa', data: top10.map(r => r.avg_sisa), backgroundColor: '#dc2626' }],
    })
  }

  const tabs = [
    { key: 'foodwaste', label: 'Tren Food Waste' },
    { key: 'diet', label: 'Distribusi Diet' },
    { key: 'bahan', label: 'Konsumsi Bahan' },
    { key: 'evaluasi', label: 'Evaluasi Menu' },
  ]

  const colEvaluasi = [
    { key: 'menu', label: 'Menu' },
    { key: 'jumlah', label: 'Jumlah Catatan' },
    { key: 'avg_sisa', label: 'Rata-rata Sisa (%)' },
    { key: 'alasan_top', label: 'Alasan Utama' },
    { key: 'status', label: 'Status', render: row =>
      row.perlu_evaluasi
        ? <Badge color="habis">Perlu Dievaluasi</Badge>
        : <Badge color="aman">Normal</Badge>
    },
  ]

  return (
    <div>
      <PageHeader title="Grafik" />

      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setChartData(null); setEvaluasiData([]) }}
            className={`px-4 py-2 text-sm rounded-lg font-medium ${tab === t.key ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab !== 'diet' && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input type="date" value={tglMulai} onChange={e => setTglMulai(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <span className="text-gray-400">s/d</span>
          <input type="date" value={tglSelesai} onChange={e => setTglSelesai(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <Button onClick={load}>Tampilkan</Button>
        </div>
      )}
      {tab === 'diet' && <div className="mb-4"><Button onClick={load}>Tampilkan</Button></div>}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {loading ? <div className="flex justify-center py-12"><Spinner /></div> : !chartData ? (
          <p className="text-center text-gray-400 py-12">Klik Tampilkan untuk memuat grafik</p>
        ) : (
          <>
            <div className="max-w-2xl mx-auto">
              {tab === 'foodwaste' && <Line data={chartData} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }} />}
              {tab === 'diet' && <Doughnut data={chartData} options={{ responsive: true }} />}
              {tab === 'bahan' && <Bar data={chartData} options={{ responsive: true, indexAxis: 'y', plugins: { legend: { display: false } } }} />}
              {tab === 'evaluasi' && <Bar data={chartData} options={{ responsive: true, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, max: 100 } } }} />}
            </div>

            {tab === 'evaluasi' && evaluasiData.length > 0 && (
              <div className="mt-6">
                <DataTable
                  columns={colEvaluasi}
                  data={evaluasiData}
                  searchKeys={['menu']}
                  pageSize={25}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
