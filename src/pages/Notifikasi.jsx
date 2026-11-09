import { useState, useEffect } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import { getNotifikasi, tandaiSemuaDibaca } from '../services/notifikasiService'
import { formatTanggal } from '../lib/format'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

const WARNA_TIPE = {
  pesanan: 'blue',
  diet: 'green',
  stok: 'yellow',
  pembelian: 'purple',
  pengembalian: 'red',
  sistem: 'gray',
}

export default function Notifikasi() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterBelum, setFilterBelum] = useState(false)
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    try {
      const rows = await getNotifikasi(200)
      setData(rows)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleTandaiSemua() {
    try {
      await tandaiSemuaDibaca()
      toast.success('Semua notifikasi ditandai dibaca')
      load()
    } catch (e) { toast.error(e.message) }
  }

  const tampil = filterBelum ? data.filter(r => !r.dibaca_at) : data

  const cols = [
    {
      header: '',
      key: row => !row.dibaca_at ? (
        <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mt-1" />
      ) : null,
    },
    {
      header: 'Tipe',
      key: row => (
        <Badge color={WARNA_TIPE[row.tipe] || 'gray'}>{row.tipe}</Badge>
      ),
    },
    { header: 'Pesan', key: 'pesan' },
    { header: 'Tanggal', key: row => formatTanggal(row.created_at?.slice(0,10)) },
    {
      header: 'Aksi',
      key: row => row.rute ? (
        <button
          onClick={() => navigate(row.rute)}
          className="text-xs text-emerald-600 hover:underline"
        >
          Buka
        </button>
      ) : null,
    },
  ]

  const belumDibaca = data.filter(r => !r.dibaca_at).length

  return (
    <div>
      <PageHeader
        title="Notifikasi"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setFilterBelum(f => !f)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium ${filterBelum ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Belum Dibaca {belumDibaca > 0 && `(${belumDibaca})`}
            </button>
            {belumDibaca > 0 && (
              <Button variant="secondary" onClick={handleTandaiSemua}>
                <CheckCheck size={16} /> Tandai Semua Dibaca
              </Button>
            )}
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <DataTable
          columns={cols}
          data={tampil}
          searchKeys={['pesan', 'tipe']}
          pageSize={20}
          rowClassName={row => !row.dibaca_at ? 'bg-blue-50' : ''}
        />
      )}
    </div>
  )
}

