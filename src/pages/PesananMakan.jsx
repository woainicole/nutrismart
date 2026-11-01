import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { isViewOnly } from '../lib/roles'
import { useLocation } from 'react-router-dom'
import { getPesanan, generatePesanan, siapkanPesanan, updateStatusPesanan, updateMenuPesanan } from '../services/pesananService'
import { getMenu } from '../services/menuService'
import { hariIni, formatTanggalLengkap } from '../lib/format'
import DataTable from '../components/ui/DataTable'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import toast from 'react-hot-toast'
import { RefreshCw, ChefHat, ArrowRight } from 'lucide-react'

const WAKTU = ['pagi', 'siang', 'malam']
const NEXT_STATUS = { disiapkan: 'siap', siap: 'terkirim' }

export default function PesananMakan() {
  const { role } = useAuth()
  const viewOnly = isViewOnly(role, useLocation().pathname)
  const [tanggal, setTanggal] = useState(hariIni())
  const [waktu, setWaktu] = useState('pagi')
  const [data, setData] = useState([])
  const [menuList, setMenuList] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => { load() }, [tanggal, waktu])

  async function load() {
    setLoading(true)
    try {
      const [p, m] = await Promise.all([getPesanan(tanggal, waktu), getMenu()])
      setData(p)
      setMenuList(m)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  async function handleGenerate() {
    setActionLoading(true)
    try {
      const count = await generatePesanan(tanggal)
      toast.success(`${count} pesanan di-generate/sinkronkan`)
      await load()
    } catch (e) { toast.error(e.message) }
    finally { setActionLoading(false) }
  }

  async function handleSiapkan() {
    setActionLoading(true)
    try {
      await siapkanPesanan(tanggal, waktu)
      toast.success('Sesi berhasil disiapkan — stok terpotong')
      await load()
    } catch (e) { toast.error(e.message) }
    finally { setActionLoading(false) }
  }

  async function handleStatusChange(id, newStatus) {
    try {
      await updateStatusPesanan(id, newStatus)
      toast.success(`Status diubah ke ${newStatus}`)
      await load()
    } catch (e) { toast.error(e.message) }
  }

  async function handleMenuPengganti(id, menuId) {
    try {
      await updateMenuPesanan(id, menuId)
      toast.success('Menu pengganti dipilih')
      await load()
    } catch (e) { toast.error(e.message) }
  }

  const columns = [
    { key: 'bangsal', label: 'Bangsal', render: r => r.pasien?.bangsal?.nama ?? '-' },
    { key: 'kamar', label: 'Kamar', render: r => r.pasien?.kamar ?? '-' },
    { key: 'pasien', label: 'Pasien', render: r => (
      <div>
        <p className="font-medium">{r.pasien?.nama}</p>
        <p className="text-xs text-gray-500">{r.pasien?.no_rm}</p>
      </div>
    )},
    { key: 'diet', label: 'Diet', render: r => r.pasien?.diet?.nama ?? '-' },
    { key: 'alergi', label: 'Alergi', render: r => {
      const alergi = r.pasien?.alergi || []
      return alergi.length > 0
        ? alergi.map(a => <Badge key={a} color="danger">{a}</Badge>)
        : <span className="text-gray-400">-</span>
    }},
    { key: 'menu', label: 'Menu', render: r => {
      // Kalau menu_id null dan ada catatan konflik, tampilkan dropdown menu pengganti
      if (!r.menu_id && r.catatan) {
        return (
          <div>
            <p className="text-xs text-yellow-600 mb-1">{r.catatan}</p>
            {role === 'ahli_gizi' || role === 'admin' ? (
              <select
                onChange={e => e.target.value && handleMenuPengganti(r.id, Number(e.target.value))}
                className="border border-yellow-300 bg-yellow-50 rounded px-2 py-1 text-xs"
                defaultValue=""
              >
                <option value="">Pilih menu pengganti</option>
                {menuList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
              </select>
            ) : null}
          </div>
        )
      }
      return r.menu?.nama ?? '-'
    }},
    { key: 'status', label: 'Status', render: r => <Badge color={r.status}>{r.status}</Badge> },
  ]

  const canGenerate = ['admin', 'ahli_gizi'].includes(role)
  const canSiapkan = ['admin', 'koki'].includes(role)
  const canChangeStatus = ['admin', 'koki'].includes(role)

  return (
    <div>
      <PageHeader title="Pesanan Makan" subtitle="Generate, siapkan, dan kelola pesanan harian" />

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <div className="flex gap-1">
          {WAKTU.map(w => (
            <button key={w} onClick={() => setWaktu(w)}
              className={`px-3 py-2 text-sm rounded-lg font-medium capitalize ${waktu === w ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {w}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-500">{formatTanggalLengkap(tanggal)}</span>
      </div>

      {/* Tombol aksi */}
      {!viewOnly && (
        <div className="flex flex-wrap gap-2 mb-4">
          {canGenerate && (
            <Button onClick={handleGenerate} disabled={actionLoading} variant="secondary">
              <RefreshCw size={16} /> Generate / Sinkronkan
            </Button>
          )}
          {canSiapkan && (
            <Button onClick={handleSiapkan} disabled={actionLoading}>
              <ChefHat size={16} /> Siapkan Sesi Ini
            </Button>
          )}
        </div>
      )}

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        searchKeys={['pasien.nama', 'pasien.no_rm']}
        actions={canChangeStatus ? row => {
          const next = NEXT_STATUS[row.status]
          if (!next) return null
          return (
            <Button size="sm" variant="ghost" onClick={() => handleStatusChange(row.id, next)}>
              <ArrowRight size={14} /> {next}
            </Button>
          )
        } : null}
      />
    </div>
  )
}

