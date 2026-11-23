import { useEffect, useState, useCallback, useMemo } from 'react'
import { formatTanggal } from '../lib/format'
import { getJadwalOperasi } from '../services/integrasiDataService'
import DataTable from '../components/ui/DataTable'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import toast from 'react-hot-toast'
import { RefreshCw, Stethoscope, AlertTriangle } from 'lucide-react'
import Button from '../components/ui/Button'

const STATUS_COLOR = {
  terjadwal: 'menunggu',
  selesai:   'success',
  batal:     'danger',
}

const STATUS_LABEL = {
  terjadwal: 'Terjadwal',
  selesai:   'Selesai',
  batal:     'Batal',
}

/** Buat set slot yang bentrok: "ruang|tanggal|jam" */
function buildKonflikSet(rows) {
  const slotCount = {}
  for (const r of rows) {
    if (!r.ruang_operasi || r.status === 'batal') continue
    const key = `${r.ruang_operasi}|${r.tanggal}|${r.jam}`
    slotCount[key] = (slotCount[key] ?? 0) + 1
  }
  const konflik = new Set()
  for (const [key, count] of Object.entries(slotCount)) {
    if (count > 1) konflik.add(key)
  }
  return konflik
}

export default function JadwalOperasi() {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTgl, setFilterTgl]       = useState('')
  const [filterRuang, setFilterRuang]   = useState('')
  const [lastSync, setLastSync]         = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const filter = {}
      if (filterStatus) filter.status  = filterStatus
      if (filterTgl)    filter.tanggal = filterTgl
      const rows = await getJadwalOperasi(filter)
      setData(rows)
      setLastSync(new Date())
    } catch (e) {
      toast.error('Gagal memuat jadwal operasi: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterTgl])

  useEffect(() => { load() }, [load])

  // Hitung konflik dari SEMUA data (sebelum filter ruang)
  const konflikSet = useMemo(() => buildKonflikSet(data), [data])

  // Daftar ruang unik untuk dropdown filter
  const ruangList = useMemo(() => {
    const s = new Set(data.map(r => r.ruang_operasi).filter(Boolean))
    return [...s].sort()
  }, [data])

  // Data setelah filter ruang (filter status/tgl sudah di server)
  const displayData = useMemo(() => {
    if (!filterRuang) return data
    return data.filter(r => r.ruang_operasi === filterRuang)
  }, [data, filterRuang])

  const isKonflik = (r) => {
    if (!r.ruang_operasi || r.status === 'batal') return false
    return konflikSet.has(`${r.ruang_operasi}|${r.tanggal}|${r.jam}`)
  }

  const jumlahKonflik = useMemo(
    () => data.filter(r => isKonflik(r)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, konflikSet]
  )

  const columns = [
    {
      key: 'tanggal',
      label: 'Tanggal',
      render: r => (
        <span className="font-medium text-gray-800">
          {r.tanggal ? formatTanggal(r.tanggal) : '-'}
        </span>
      ),
    },
    { key: 'jam', label: 'Jam', render: r => r.jam ?? '-' },
    { key: 'no_rm', label: 'No RM', render: r => <span className="font-mono text-xs">{r.no_rm || '-'}</span> },
    { key: 'nama_pasien', label: 'Nama Pasien' },
    {
      key: 'tindakan',
      label: 'Tindakan / Operasi',
      render: r => (
        <span className="inline-flex items-center gap-1.5">
          <Stethoscope size={13} className="text-indigo-400 shrink-0" />
          {r.tindakan || '-'}
        </span>
      ),
    },
    { key: 'dokter', label: 'Dokter', render: r => r.dokter || '-' },
    {
      key: 'ruang_operasi',
      label: 'Ruang Operasi',
      render: r => {
        const konflik = isKonflik(r)
        return (
          <span className={`inline-flex items-center gap-1 font-medium ${konflik ? 'text-red-600' : 'text-gray-700'}`}>
            {r.ruang_operasi || <span className="text-gray-300">-</span>}
            {konflik && (
              <span title="Ruangan sudah terpakai di slot ini!">
                <AlertTriangle size={13} className="text-red-500" />
              </span>
            )}
          </span>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: r => {
        const konflik = isKonflik(r)
        return (
          <span className="inline-flex flex-col gap-0.5 items-start">
            <Badge color={STATUS_COLOR[r.status] ?? 'menunggu'}>
              {STATUS_LABEL[r.status] ?? r.status}
            </Badge>
            {konflik && (
              <Badge color="danger">⚠ Konflik Ruangan</Badge>
            )}
          </span>
        )
      },
    },
    {
      key: 'catatan',
      label: 'Catatan',
      render: r => r.catatan
        ? <span className="text-xs text-gray-500 max-w-[180px] block truncate" title={r.catatan}>{r.catatan}</span>
        : <span className="text-gray-300">-</span>,
    },
  ]

  // Ringkasan
  const total     = displayData.length
  const terjadwal = displayData.filter(d => d.status === 'terjadwal').length
  const selesai   = displayData.filter(d => d.status === 'selesai').length
  const batal     = displayData.filter(d => d.status === 'batal').length

  // Row class untuk highlight konflik
  const rowClassName = (r) =>
    isKonflik(r) ? 'bg-red-50 border-l-4 border-red-400' : ''

  return (
    <div>
      <PageHeader
        title="Jadwal Operasi"
        subtitle="Data dari AdmisiRS · hanya baca"
      />

      {/* Banner konflik */}
      {jumlahKonflik > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0" />
          <span>
            <strong>{jumlahKonflik} jadwal</strong> terdeteksi bentrok — ruangan yang sama dijadwalkan
            lebih dari satu operasi di slot waktu yang sama. Perbaiki di AdmisiRS.
          </span>
        </div>
      )}

      {/* Kartu ringkasan */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg border bg-white px-4 py-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-800">{total}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Jadwal</p>
        </div>
        <div className="rounded-lg border bg-white px-4 py-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-amber-600">{terjadwal}</p>
          <p className="text-xs text-gray-500 mt-0.5">Terjadwal</p>
        </div>
        <div className="rounded-lg border bg-white px-4 py-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-emerald-600">{selesai}</p>
          <p className="text-xs text-gray-500 mt-0.5">Selesai</p>
        </div>
        <div className="rounded-lg border bg-white px-4 py-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-red-600">{batal}</p>
          <p className="text-xs text-gray-500 mt-0.5">Batal</p>
        </div>
      </div>

      {/* Filter + Refresh */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          type="date"
          value={filterTgl}
          onChange={e => setFilterTgl(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Semua Status</option>
          <option value="terjadwal">Terjadwal</option>
          <option value="selesai">Selesai</option>
          <option value="batal">Batal</option>
        </select>
        <select
          value={filterRuang}
          onChange={e => setFilterRuang(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Semua Ruang Operasi</option>
          {ruangList.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        {(filterTgl || filterStatus || filterRuang) && (
          <button
            onClick={() => { setFilterTgl(''); setFilterStatus(''); setFilterRuang('') }}
            className="text-xs text-gray-400 hover:text-gray-700 underline"
          >
            Reset filter
          </button>
        )}

        <div className="ml-auto flex items-center gap-2 text-xs text-gray-400">
          {lastSync && <span>Diperbarui {lastSync.toLocaleTimeString('id-ID')}</span>}
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabel */}
      {displayData.length === 0 && !loading ? (
        <div className="rounded-lg border bg-white p-10 text-center">
          <p className="text-4xl mb-3">🏥</p>
          <p className="font-medium text-gray-700">Belum ada jadwal operasi</p>
          <p className="text-sm text-gray-400 mt-1">
            Data muncul di sini setelah staf AdmisiRS menginput dan mengirim jadwal operasi.
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={displayData}
          loading={loading}
          searchKeys={['nama_pasien', 'no_rm', 'tindakan', 'dokter', 'ruang_operasi']}
          rowClassName={rowClassName}
        />
      )}
    </div>
  )
}
