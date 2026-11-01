import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getPesananTerkirimTanpaPengembalian, createPengembalian, getPengembalian } from '../services/pengembalianService'
import { hariIni, formatTanggal } from '../lib/format'
import DataTable from '../components/ui/DataTable'
import PageHeader from '../components/ui/PageHeader'
import Modal from '../components/ui/Modal'
import FormField from '../components/ui/FormField'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'

const PERSEN_OPTIONS = [0, 25, 50, 75, 100]
const ALASAN_OPTIONS = [
  { value: 'mual', label: 'Mual' },
  { value: 'menu_tidak_cocok', label: 'Menu Tidak Cocok' },
  { value: 'nafsu_makan_menurun', label: 'Nafsu Makan Menurun' },
  { value: 'pasien_pulang', label: 'Pasien Pulang' },
  { value: 'porsi_terlalu_banyak', label: 'Porsi Terlalu Banyak' },
  { value: 'lainnya', label: 'Lainnya' },
]

export default function Pengembalian() {
  const { profile } = useAuth()
  const [data, setData] = useState([])
  const [pesananBelum, setPesananBelum] = useState([])
  const [loading, setLoading] = useState(true)
  const [tanggal, setTanggal] = useState(hariIni())
  const [waktu, setWaktu] = useState('pagi')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ pesanan_id: '', persen_sisa: '0', alasan: 'mual' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [tanggal, waktu])

  async function load() {
    setLoading(true)
    try {
      const [riwayat, belum] = await Promise.all([
        getPengembalian(tanggal, waktu),
        getPesananTerkirimTanpaPengembalian(tanggal, waktu),
      ])
      setData(riwayat)
      setPesananBelum(belum)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  function openAdd() {
    setForm({ pesanan_id: '', persen_sisa: '0', alasan: 'mual' })
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await createPengembalian({
        pesanan_id: Number(form.pesanan_id),
        persen_sisa: Number(form.persen_sisa),
        alasan: form.alasan,
        dicatat_oleh: profile.id,
      })
      toast.success('Pengembalian dicatat')
      setModalOpen(false)
      await load()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const columns = [
    { key: 'pasien', label: 'Pasien', render: r => r.pesanan?.pasien?.nama ?? '-' },
    { key: 'bangsal', label: 'Bangsal', render: r => r.pesanan?.pasien?.bangsal?.nama ?? '-' },
    { key: 'menu', label: 'Menu', render: r => r.pesanan?.menu?.nama ?? '-' },
    { key: 'persen_sisa', label: '% Sisa', render: r => <Badge color={r.persen_sisa >= 50 ? 'danger' : r.persen_sisa >= 25 ? 'warning' : 'success'}>{r.persen_sisa}%</Badge> },
    { key: 'alasan', label: 'Alasan', render: r => ALASAN_OPTIONS.find(a => a.value === r.alasan)?.label ?? r.alasan },
    { key: 'created_at', label: 'Dicatat', render: r => formatTanggal(r.created_at) },
  ]

  return (
    <div>
      <PageHeader title="Pengembalian Makanan" action={openAdd} actionLabel="Catat Pengembalian" actionIcon={Plus} />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <div className="flex gap-1">
          {['pagi', 'siang', 'malam'].map(w => (
            <button key={w} onClick={() => setWaktu(w)}
              className={`px-3 py-2 text-sm rounded-lg font-medium capitalize ${waktu === w ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {w}
            </button>
          ))}
        </div>
      </div>

      <DataTable columns={columns} data={data} loading={loading} emptyMessage="Belum ada catatan pengembalian" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Catat Pengembalian Makanan">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Pesanan (terkirim, belum dicatat)" required>
            <select value={form.pesanan_id} onChange={e => setForm(f => ({ ...f, pesanan_id: e.target.value }))} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Pilih pesanan</option>
              {pesananBelum.map(p => (
                <option key={p.id} value={p.id}>
                  {p.pasien?.nama} — {p.menu?.nama}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Sisa Makanan (%)" required>
            <select value={form.persen_sisa} onChange={e => setForm(f => ({ ...f, persen_sisa: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {PERSEN_OPTIONS.map(p => <option key={p} value={p}>{p}%</option>)}
            </select>
          </FormField>
          <FormField label="Alasan" required>
            <select value={form.alasan} onChange={e => setForm(f => ({ ...f, alasan: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {ALASAN_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

