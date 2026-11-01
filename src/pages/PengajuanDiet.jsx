import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getPengajuanDiet, createPengajuanDiet, setujuiDiet, tolakDiet } from '../services/pengajuanService'
import { getPasien } from '../services/pasienService'
import { getJenisDiet } from '../services/dietService'
import { formatTanggal } from '../lib/format'
import DataTable from '../components/ui/DataTable'
import PageHeader from '../components/ui/PageHeader'
import Modal from '../components/ui/Modal'
import FormField from '../components/ui/FormField'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import toast from 'react-hot-toast'
import { Plus, Check, X } from 'lucide-react'

export default function PengajuanDiet() {
  const { role, profile } = useAuth()
  const [data, setData] = useState([])
  const [pasienList, setPasienList] = useState([])
  const [dietList, setDietList] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ pasien_id: '', diet_baru_id: '', tanggal_berlaku: '', waktu_makan: 'pagi', alasan: '' })
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')

  const isPerawat = role === 'perawat'
  const canApprove = ['admin', 'ahli_gizi'].includes(role)
  const canCreate = ['admin', 'perawat'].includes(role)

  useEffect(() => { load() }, [filterStatus])

  async function load() {
    setLoading(true)
    try {
      const filter = filterStatus ? { status: filterStatus } : {}
      const [pg, pasien, diet] = await Promise.all([
        getPengajuanDiet(filter), getPasien({ status: 'aktif' }), getJenisDiet()
      ])
      setData(pg)
      setPasienList(pasien)
      setDietList(diet)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  function openAdd() {
    // Perawat: filter pasien berdasarkan bangsal_id profil
    setForm({ pasien_id: '', diet_baru_id: '', tanggal_berlaku: '', waktu_makan: 'pagi', alasan: '' })
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const pasien = pasienList.find(p => p.id === Number(form.pasien_id))
      await createPengajuanDiet({
        pasien_id: Number(form.pasien_id),
        diet_lama_id: pasien?.jenis_diet_id || null,
        diet_baru_id: Number(form.diet_baru_id),
        tanggal_berlaku: form.tanggal_berlaku,
        waktu_makan: form.waktu_makan,
        alasan: form.alasan,
        diajukan_oleh: profile.id,
      })
      toast.success('Pengajuan berhasil dibuat')
      setModalOpen(false)
      await load()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function handleSetujui(id) {
    try {
      await setujuiDiet(id)
      toast.success('Pengajuan disetujui — diet pasien berubah')
      await load()
    } catch (e) { toast.error(e.message) }
  }

  async function handleTolak(id) {
    try {
      await tolakDiet(id)
      toast.success('Pengajuan ditolak')
      await load()
    } catch (e) { toast.error(e.message) }
  }

  // Pasien yang ditampilkan di dropdown (perawat: hanya bangsalnya)
  const filteredPasien = isPerawat && profile.bangsal_id
    ? pasienList.filter(p => p.bangsal_id === profile.bangsal_id)
    : pasienList

  const columns = [
    { key: 'pasien', label: 'Pasien', render: r => `${r.pasien?.nama} (${r.pasien?.no_rm})` },
    { key: 'diet_lama', label: 'Diet Lama', render: r => r.diet_lama?.nama ?? '-' },
    { key: 'diet_baru', label: 'Diet Baru', render: r => r.diet_baru?.nama ?? '-' },
    { key: 'tanggal_berlaku', label: 'Berlaku', render: r => formatTanggal(r.tanggal_berlaku) },
    { key: 'waktu_makan', label: 'Waktu', render: r => <span className="capitalize">{r.waktu_makan}</span> },
    { key: 'alasan', label: 'Alasan' },
    { key: 'pengaju', label: 'Diajukan', render: r => r.pengaju?.nama ?? '-' },
    { key: 'status', label: 'Status', render: r => <Badge color={r.status}>{r.status}</Badge> },
  ]

  return (
    <div>
      <PageHeader title="Pengajuan Ubah Diet" action={canCreate ? openAdd : null} actionLabel="Buat Pengajuan" actionIcon={Plus} />

      <div className="flex gap-2 mb-4">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Semua Status</option>
          <option value="menunggu">Menunggu</option>
          <option value="disetujui">Disetujui</option>
          <option value="ditolak">Ditolak</option>
        </select>
      </div>

      <DataTable columns={columns} data={data} loading={loading} searchKeys={['pasien.nama', 'alasan']}
        actions={canApprove ? row => {
          if (row.status !== 'menunggu') return null
          return (
            <>
              <Button size="sm" variant="ghost" onClick={() => handleSetujui(row.id)} title="Setujui"><Check size={14} className="text-green-600" /></Button>
              <Button size="sm" variant="ghost" onClick={() => handleTolak(row.id)} title="Tolak"><X size={14} className="text-red-600" /></Button>
            </>
          )
        } : null}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Buat Pengajuan Ubah Diet">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Pasien" required>
            <select value={form.pasien_id} onChange={e => setForm(f => ({ ...f, pasien_id: e.target.value }))} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Pilih pasien</option>
              {filteredPasien.map(p => <option key={p.id} value={p.id}>{p.nama} ({p.no_rm}) — {p.diet?.nama}</option>)}
            </select>
          </FormField>
          <FormField label="Diet Baru" required>
            <select value={form.diet_baru_id} onChange={e => setForm(f => ({ ...f, diet_baru_id: e.target.value }))} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Pilih diet</option>
              {dietList.map(d => <option key={d.id} value={d.id}>{d.nama}</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tanggal Berlaku" required>
              <input type="date" value={form.tanggal_berlaku} onChange={e => setForm(f => ({ ...f, tanggal_berlaku: e.target.value }))} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </FormField>
            <FormField label="Waktu Makan" required>
              <select value={form.waktu_makan} onChange={e => setForm(f => ({ ...f, waktu_makan: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="pagi">Pagi</option>
                <option value="siang">Siang</option>
                <option value="malam">Malam</option>
              </select>
            </FormField>
          </div>
          <FormField label="Alasan" required>
            <textarea value={form.alasan} onChange={e => setForm(f => ({ ...f, alasan: e.target.value }))} required rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Mengirim...' : 'Ajukan'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

