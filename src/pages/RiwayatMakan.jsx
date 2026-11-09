import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isViewOnly } from '../lib/roles'
import { getPasien } from '../services/pasienService'
import { getRiwayatMakan, getRiwayatDietPasien } from '../services/riwayatService'
import { hariIni, formatTanggal, formatTanggalLengkap } from '../lib/format'
import { exportCsv } from '../lib/exportCsv'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import toast from 'react-hot-toast'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend
} from 'chart.js'
import { Download, Printer } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const WAKTU_ORDER = ['pagi', 'siang', 'malam']
const PRESET = [
  { label: '7 hari', days: 7 },
  { label: '14 hari', days: 14 },
  { label: '30 hari', days: 30 },
]

function dateOffset(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export default function RiwayatMakan() {
  const { role } = useAuth()
  const viewOnly = isViewOnly(role, '/riwayat-makan')
  const [searchParams] = useSearchParams()

  const [pasienList, setPasienList] = useState([])
  const [cariPasien, setCariPasien] = useState('')
  const [selectedPasien, setSelectedPasien] = useState(null)
  const [tglMulai, setTglMulai] = useState(dateOffset(7))
  const [tglSelesai, setTglSelesai] = useState(hariIni())
  const [riwayat, setRiwayat] = useState([])
  const [riwayatDiet, setRiwayatDiet] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingPasien, setLoadingPasien] = useState(true)

  // Catatan gizi state (T-47)
  const [catatan, setCatatan] = useState([])
  const [formCatatan, setFormCatatan] = useState({ tanggal: hariIni(), catatan: '' })
  const [savingCatatan, setSavingCatatan] = useState(false)
  const canEditCatatan = ['admin', 'ahli_gizi'].includes(role)

  useEffect(() => {
    getPasien({ status: 'aktif' }).then(d => {
      setPasienList(d)
      // Jika datang dari query param ?pasien=ID
      const pid = searchParams.get('pasien')
      if (pid) {
        const p = d.find(x => x.id === Number(pid))
        if (p) setSelectedPasien(p)
      }
    }).catch(e => toast.error(e.message))
      .finally(() => setLoadingPasien(false))
  }, [])

  useEffect(() => {
    if (selectedPasien) loadRiwayat()
  }, [selectedPasien, tglMulai, tglSelesai])

  async function loadRiwayat() {
    setLoading(true)
    try {
      const [r, rd] = await Promise.all([
        getRiwayatMakan(selectedPasien.id, tglMulai, tglSelesai),
        getRiwayatDietPasien(selectedPasien.id),
      ])
      setRiwayat(r)
      setRiwayatDiet(rd)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  // Load catatan gizi saat pasien berubah
  async function loadCatatan(pasienId) {
    try {
      const { data, error } = await supabase
        .from('catatan_gizi')
        .select('*, dibuat:profiles!dibuat_oleh(nama)')
        .eq('pasien_id', pasienId)
        .order('tanggal', { ascending: false })
        .limit(30)
      if (error) throw error
      setCatatan(data || [])
    } catch (e) { console.error('catatan_gizi tidak tersedia:', e.message) }
  }

  useEffect(() => {
    if (selectedPasien) {
      loadCatatan(selectedPasien.id)
    } else {
      setCatatan([])
    }
  }, [selectedPasien])

  async function handleSimpanCatatan(e) {
    e.preventDefault()
    if (!selectedPasien) return
    setSavingCatatan(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('catatan_gizi').upsert(
        { pasien_id: selectedPasien.id, tanggal: formCatatan.tanggal, catatan: formCatatan.catatan, dibuat_oleh: user.id },
        { onConflict: 'pasien_id,tanggal' }
      )
      if (error) throw error
      toast.success('Catatan disimpan')
      setFormCatatan(f => ({ ...f, catatan: '' }))
      await loadCatatan(selectedPasien.id)
    } catch (e) { toast.error(e.message) }
    finally { setSavingCatatan(false) }
  }

  // Kartu ringkasan
  const ringkasan = useMemo(() => {
    const tercatat = riwayat.filter(r => r.persen_sisa != null)
    const terkirim = riwayat.filter(r => r.status === 'terkirim')
    const belumCatat = terkirim.filter(r => r.persen_sisa == null).length
    const ratasSisa = tercatat.length ? Math.round(tercatat.reduce((s, r) => s + r.persen_sisa, 0) / tercatat.length) : null
    // Kalori per hari
    const perHari = {}
    riwayat.forEach(r => {
      if (r.kalori_dikonsumsi != null) perHari[r.tanggal] = (perHari[r.tanggal] || 0) + r.kalori_dikonsumsi
    })
    const hariArr = Object.values(perHari)
    const rataKalori = hariArr.length ? Math.round(hariArr.reduce((s, v) => s + v, 0) / hariArr.length) : null
    return { jumlah: riwayat.length, belumCatat, ratasSisa, rataKalori }
  }, [riwayat])

  // Timeline per hari
  const perHari = useMemo(() => {
    const map = {}
    riwayat.forEach(r => {
      if (!map[r.tanggal]) map[r.tanggal] = {}
      map[r.tanggal][r.waktu_makan] = r
    })
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]))
  }, [riwayat])

  // Data grafik
  const grafikData = useMemo(() => {
    const perHariKalori = {}
    const perHariSisa = {}
    riwayat.forEach(r => {
      if (r.kalori_dikonsumsi != null) perHariKalori[r.tanggal] = (perHariKalori[r.tanggal] || 0) + r.kalori_dikonsumsi
      if (r.persen_sisa != null) {
        if (!perHariSisa[r.tanggal]) perHariSisa[r.tanggal] = []
        perHariSisa[r.tanggal].push(r.persen_sisa)
      }
    })
    const labels = [...new Set([...Object.keys(perHariKalori), ...Object.keys(perHariSisa)])].sort()
    return {
      labels: labels.map(formatTanggal),
      datasets: [
        {
          label: 'Kalori dikonsumsi (kkal)',
          data: labels.map(d => perHariKalori[d] ?? null),
          borderColor: 'rgb(16,185,129)', backgroundColor: 'rgba(16,185,129,0.1)',
          yAxisID: 'y', tension: 0.3,
        },
        {
          label: 'Rata-rata sisa (%)',
          data: labels.map(d => perHariSisa[d] ? Math.round(perHariSisa[d].reduce((s, v) => s + v, 0) / perHariSisa[d].length) : null),
          borderColor: 'rgb(249,115,22)', backgroundColor: 'rgba(249,115,22,0.1)',
          yAxisID: 'y2', tension: 0.3,
        },
      ],
    }
  }, [riwayat])

  function handleExport() {
    const rows = riwayat.map(r => [r.tanggal, r.waktu_makan, r.menu ?? '-', r.status, r.persen_sisa ?? '-', r.alasan ?? '-', r.kalori_dikonsumsi ?? '-', r.diet ?? '-'])
    exportCsv(`riwayat-${selectedPasien?.no_rm}-${tglMulai}-${tglSelesai}.csv`,
      ['Tanggal', 'Waktu', 'Menu', 'Status', '% Sisa', 'Alasan', 'Kalori Dikonsumsi', 'Diet'], rows)
    toast.success('CSV berhasil diunduh')
  }

  // Filter list pasien dengan pencarian
  const pasienFiltered = cariPasien.trim()
    ? pasienList.filter(p => `${p.nama} ${p.no_rm} ${p.kamar ?? ''}`.toLowerCase().includes(cariPasien.toLowerCase()))
    : pasienList

  return (
    <div>
      <PageHeader title="Riwayat Makan Pasien" subtitle="Timeline asupan pagi / siang / malam per pasien" />

      {/* Pemilih pasien */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Cari & Pilih Pasien</label>
        <div className="flex gap-2 mb-2">
          <input
            value={cariPasien}
            onChange={e => setCariPasien(e.target.value)}
            placeholder="Nama, no. RM, kamar..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        {loadingPasien ? <Spinner /> : (
          <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-lg divide-y text-sm">
            {pasienFiltered.length === 0 ? (
              <p className="p-3 text-gray-400">Tidak ada pasien ditemukan.</p>
            ) : pasienFiltered.map(p => (
              <button key={p.id} onClick={() => { setSelectedPasien(p); setCariPasien('') }}
                className={`w-full text-left px-3 py-2 hover:bg-emerald-50 ${selectedPasien?.id === p.id ? 'bg-emerald-50 font-medium text-emerald-700' : ''}`}>
                {p.nama} · {p.no_rm} · {p.bangsal?.nama ?? '-'} {p.kamar ? `Kamar ${p.kamar}` : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      {!selectedPasien ? (
        <EmptyState message="Pilih pasien untuk melihat riwayat makan" />
      ) : (
        <>
          {/* Kartu profil */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-800">{selectedPasien.nama}</h2>
              <p className="text-sm text-gray-500">{selectedPasien.no_rm} · {selectedPasien.bangsal?.nama} {selectedPasien.kamar}</p>
              <p className="text-sm text-gray-500 mt-1">{selectedPasien.diagnosa || 'Tanpa diagnosa'}</p>
            </div>
            <div className="flex flex-wrap gap-1 items-start">
              {(selectedPasien.alergi || []).map(a => <Badge key={a} color="danger">{a}</Badge>)}
              {selectedPasien.diet && <Badge color="info">{selectedPasien.diet?.nama ?? selectedPasien.jenis_diet_id}</Badge>}
            </div>
          </div>

          {/* Filter rentang tanggal */}
          <div className="flex flex-wrap gap-2 mb-4 items-center">
            <div className="flex gap-1">
              {PRESET.map(p => (
                <button key={p.label} onClick={() => { setTglMulai(dateOffset(p.days)); setTglSelesai(hariIni()) }}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                  {p.label}
                </button>
              ))}
            </div>
            <input type="date" value={tglMulai} onChange={e => setTglMulai(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <span className="text-gray-400">s.d.</span>
            <input type="date" value={tglSelesai} onChange={e => setTglSelesai(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <div className="ml-auto flex gap-2">
              <button onClick={handleExport} className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"><Download size={14} /> CSV</button>
              <button onClick={() => window.print()} className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"><Printer size={14} /> Cetak</button>
            </div>
          </div>

          {/* Ringkasan */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard title="Makan Tercatat" value={ringkasan.jumlah} />
            <StatCard title="Belum Dicatat Sisa" value={ringkasan.belumCatat} />
            <StatCard title="Rata-rata Sisa" value={ringkasan.ratasSisa != null ? `${ringkasan.ratasSisa}%` : '-'} />
            <StatCard title="Rata-rata Kalori/Hari" value={ringkasan.rataKalori != null ? `${ringkasan.rataKalori} kkal` : '-'} />
          </div>

          {loading ? <Spinner /> : riwayat.length === 0 ? (
            <EmptyState message="Tidak ada data riwayat pada rentang tanggal ini" />
          ) : (
            <>
              {/* Grafik */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Tren Asupan</h3>
                <Line data={grafikData} options={{
                  responsive: true, interaction: { mode: 'index' },
                  scales: {
                    y: { type: 'linear', position: 'left', title: { display: true, text: 'Kalori (kkal)' } },
                    y2: { type: 'linear', position: 'right', min: 0, max: 100, title: { display: true, text: '% Sisa' }, grid: { drawOnChartArea: false } },
                  },
                  plugins: { legend: { position: 'top' } },
                }} />
              </div>

              {/* Timeline per hari */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tanggal</th>
                      {WAKTU_ORDER.map(w => (
                        <th key={w} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase capitalize">{w}</th>
                      ))}
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Kalori/hr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perHari.map(([tgl, waktuMap]) => {
                      const kaloriHari = WAKTU_ORDER.reduce((s, w) => s + (waktuMap[w]?.kalori_dikonsumsi ?? 0), 0)
                      return (
                        <tr key={tgl} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">{formatTanggalLengkap(tgl)}</td>
                          {WAKTU_ORDER.map(w => {
                            const r = waktuMap[w]
                            if (!r) return <td key={w} className="px-4 py-3 text-gray-300">—</td>
                            return (
                              <td key={w} className="px-4 py-3">
                                <p className="font-medium text-gray-800">{r.menu ?? '—'}</p>
                                <Badge color={r.status} className="text-xs">{r.status}</Badge>
                                {r.persen_sisa != null && (
                                  <div className="mt-1">
                                    <div className="h-1.5 rounded-full bg-gray-200 w-24">
                                      <div className="h-1.5 rounded-full bg-orange-400" style={{ width: `${r.persen_sisa}%` }} />
                                    </div>
                                    <span className="text-xs text-gray-500">Sisa {r.persen_sisa}%{r.alasan ? ` (${r.alasan})` : ''}</span>
                                  </div>
                                )}
                                {r.kalori_dikonsumsi != null && <p className="text-xs text-gray-400">{r.kalori_dikonsumsi} kkal</p>}
                              </td>
                            )
                          })}
                          <td className="px-4 py-3 text-sm font-medium text-emerald-700">{kaloriHari > 0 ? `${kaloriHari} kkal` : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Riwayat perubahan diet */}
              {riwayatDiet.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Riwayat Perubahan Diet</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                        <th className="py-2 text-left">Tanggal Berlaku</th>
                        <th className="py-2 text-left">Diet Lama</th>
                        <th className="py-2 text-left">Diet Baru</th>
                        <th className="py-2 text-left">Alasan</th>
                        <th className="py-2 text-left">Disetujui</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riwayatDiet.map(r => (
                        <tr key={r.id} className="border-b border-gray-50">
                          <td className="py-2">{formatTanggal(r.tanggal_berlaku)}</td>
                          <td className="py-2">{r.diet_lama?.nama ?? '-'}</td>
                          <td className="py-2 font-medium">{r.diet_baru?.nama}</td>
                          <td className="py-2 text-gray-500">{r.alasan}</td>
                          <td className="py-2 text-gray-500">{r.penyetuju?.nama ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Catatan Ahli Gizi (T-47) */}
      {selectedPasien && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Catatan Ahli Gizi</h3>

          {canEditCatatan && (
            <form onSubmit={handleSimpanCatatan} className="mb-4 space-y-3">
              <div className="flex gap-3 items-start">
                <input
                  type="date"
                  value={formCatatan.tanggal}
                  onChange={e => setFormCatatan(f => ({ ...f, tanggal: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm shrink-0"
                />
                <textarea
                  value={formCatatan.catatan}
                  onChange={e => setFormCatatan(f => ({ ...f, catatan: e.target.value }))}
                  required
                  rows={2}
                  placeholder="Tulis catatan asupan / kondisi pasien..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                />
                <button
                  type="submit"
                  disabled={savingCatatan}
                  className="shrink-0 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {savingCatatan ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          )}

          {catatan.length === 0 ? (
            <p className="text-sm text-gray-400">Belum ada catatan untuk pasien ini.</p>
          ) : (
            <ul className="divide-y divide-gray-100 space-y-0">
              {catatan.map(c => (
                <li key={c.id} className="py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-500">{formatTanggal(c.tanggal)}</span>
                    {c.dibuat?.nama && (
                      <span className="text-xs text-gray-400">— {c.dibuat.nama}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.catatan}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

