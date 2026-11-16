import { useEffect, useState, useCallback } from 'react'
import { formatTanggal } from '../lib/format'
import { getJadwalOperasi } from '../services/integrasiDataService'
import DataTable from '../components/ui/DataTable'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import toast from 'react-hot-toast'
import { RefreshCw, Stethoscope } from 'lucide-react'
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

export default function JadwalOperasi() {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTgl, setFilterTgl]       = useState('')
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
      key: 'status',
      label: 'Status',
      render: r => (
        <Badge color={STATUS_COLOR[r.status] ?? 'menunggu'}>
          {STATUS_LABEL[r.status] ?? r.status}
        </Badge>
      ),
    },
    {
      key: 'catatan',
      label: 'Catatan',
      render: r => r.catatan
        ? <span className="text-xs text-gray-500 max-w-[180px] block truncate" title={r.catatan}>{r.catatan}</span>
        : <span className="text-gray-300">-</span>,
    },
  ]

  // Ringkasan cepat
  const total      = data.length
  const terjadwal  = data.filter(d => d.status === 'terjadwal').length
  const selesai    = data.filter(d => d.status === 'selesai').length

  return (
    <div>
      <PageHeader
        title="Jadwal Operasi"
        subtitle="Data dari AdmisiRS · hanya baca"
      />

      {/* Info banner */}
      <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700 flex items-start gap-2">
        <span className="text-lg leading-none">🏥</span>
        <span>
          Jadwal operasi dikirim dari <strong>AdmisiRS</strong> lewat ekstensi browser.
          Data ini <strong>hanya bisa dilihat</strong> di NutriSmart — perubahan jadwal dilakukan di AdmisiRS.
        </span>
      </div>

      {/* Kartu ringkasan */}
      <div className="grid grid-cols-3 gap-3 mb-4">
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
        {(filterTgl || filterStatus) && (
          <button
            onClick={() => { setFilterTgl(''); setFilterStatus('') }}
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
      {data.length === 0 && !loading ? (
        <div className="rounded-lg border bg-white p-10 text-center">
          <p className="text-4xl mb-3">🏥</p>
          <p className="font-medium text-gray-700">Belum ada jadwal operasi</p>
          <p className="text-sm text-gray-400 mt-1">
            Data muncul di sini setelah staf AdmisiRS menginput jadwal dan mengirimnya lewat ekstensi browser,
            atau setelah kamu menjalankan script sync awal.
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          searchKeys={['nama_pasien', 'no_rm', 'tindakan', 'dokter']}
        />
      )}
    </div>
  )
}
