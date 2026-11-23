import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { isViewOnly } from '../../lib/roles'
import { getPasien, createPasien, updatePasien, deletePasien, getNextNoRm, getKamarKosong } from '../../services/pasienService'
import { getBangsal, getJenisDiet } from '../../services/dietService'
import { formatTanggal } from '../../lib/format'
import DataTable from '../../components/ui/DataTable'
import PageHeader from '../../components/ui/PageHeader'
import Modal from '../../components/ui/Modal'
import FormField from '../../components/ui/FormField'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2 } from 'lucide-react'

export default function Pasien() {
  const { role } = useAuth()
  const viewOnly = isViewOnly(role, useLocation().pathname)
  const [data, setData] = useState([])
  const [bangsalList, setBangsalList] = useState([])
  const [dietList, setDietList] = useState([])
  const [kamarList, setKamarList] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterBangsal, setFilterBangsal] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ no_rm: '', nama: '', tgl_lahir: '', jenis_kelamin: 'L', bangsal_id: '', kamar: '', diagnosa: '', alergi: '', jenis_diet_id: '', status: 'aktif' })
  const [deleting, setDeleting] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [filterBangsal])

  async function load() {
    setLoading(true)
    try {
      const filter = filterBangsal ? { bangsal_id: filterBangsal } : {}
      const [pasien, bangsal, diet] = await Promise.all([
        getPasien(filter), getBangsal(), getJenisDiet()
      ])
      setData(pasien)
      setBangsalList(bangsal)
      setDietList(diet)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  async function openAdd() {
    setEditing(null)
    const nextRm = await getNextNoRm().catch(() => '')
    setForm({ no_rm: nextRm, nama: '', tgl_lahir: '', jenis_kelamin: 'L', bangsal_id: '', kamar: '', diagnosa: '', alergi: '', jenis_diet_id: '', status: 'aktif' })
    setKamarList([])
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      no_rm: row.no_rm,
      nama: row.nama,
      tgl_lahir: row.tgl_lahir ?? '',
      jenis_kelamin: row.jenis_kelamin ?? 'L',
      bangsal_id: row.bangsal_id ?? '',
      kamar: row.kamar ?? '',
      diagnosa: row.diagnosa ?? '',
      alergi: (row.alergi || []).join(', '),
      jenis_diet_id: row.jenis_diet_id ?? '',
      status: row.status,
    })
    // Muat kamar kosong sesuai bangsal pasien saat ini
    const bangsalNama = bangsalList.find(b => b.id === row.bangsal_id)?.nama || ''
    getKamarKosong(bangsalNama).then(setKamarList).catch(() => setKamarList([]))
    setModalOpen(true)
  }

  // Saat bangsal berubah di form, muat ulang daftar kamar kosong
  async function handleBangsalChange(bangsalId) {
    setForm(f => ({ ...f, bangsal_id: bangsalId, kamar: '' }))
    const bangsalNama = bangsalList.find(b => String(b.id) === String(bangsalId))?.nama || ''
    const kamar = await getKamarKosong(bangsalNama).catch(() => [])
    setKamarList(kamar)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        no_rm: form.no_rm,
        nama: form.nama,
        tgl_lahir: form.tgl_lahir || null,
        jenis_kelamin: form.jenis_kelamin || null,
        bangsal_id: form.bangsal_id ? Number(form.bangsal_id) : null,
        kamar: form.kamar || null,
        diagnosa: form.diagnosa || null,
        alergi: form.alergi, // service handles string → array
        jenis_diet_id: form.jenis_diet_id ? Number(form.jenis_diet_id) : null,
        status: form.status,
      }
      if (editing) await updatePasien(editing.id, payload)
      else await createPasien(payload)
      toast.success(editing ? 'Pasien diperbarui' : 'Pasien ditambahkan')
      setModalOpen(false)
      await load()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await deletePasien(deleting.id)
      toast.success('Pasien dihapus')
      setDeleting(null)
      await load()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const columns = [
    { key: 'no_rm', label: 'No RM' },
    { key: 'nama', label: 'Nama' },
    { key: 'tgl_lahir', label: 'Tgl Lahir', render: r => r.tgl_lahir ? formatTanggal(r.tgl_lahir) : '-' },
    { key: 'jenis_kelamin', label: 'JK', render: r => r.jenis_kelamin ?? '-' },
    { key: 'bangsal', label: 'Bangsal', render: r => r.bangsal?.nama ?? '-' },
    { key: 'kamar', label: 'Kamar', render: r => r.kamar ?? '-' },
    { key: 'alergi', label: 'Alergi', render: r => (r.alergi?.length > 0
      ? r.alergi.map(a => <Badge key={a} color="danger">{a}</Badge>)
      : <span className="text-gray-400">-</span>
    )},
    { key: 'diet', label: 'Diet', render: r => r.diet?.nama ?? '-' },
    { key: 'status', label: 'Status', render: r => <Badge color={r.status === 'aktif' ? 'success' : 'menunggu'}>{r.status}</Badge> },
  ]

  return (
    <div>
      <PageHeader title="Pasien" action={viewOnly ? null : openAdd} actionLabel="Tambah Pasien" actionIcon={Plus} />

      <div className="mb-4">
        <select value={filterBangsal} onChange={e => setFilterBangsal(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Semua Bangsal</option>
          {bangsalList.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}
        </select>
      </div>

      <DataTable columns={columns} data={data} loading={loading} searchKeys={['nama', 'no_rm']}
        actions={viewOnly ? null : row => (
          <>
            <Button variant="ghost" size="sm" onClick={() => openEdit(row)}><Pencil size={14} /></Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(row)}><Trash2 size={14} /></Button>
          </>
        )}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Pasien' : 'Tambah Pasien'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="No Rekam Medis" required>
              <input
                value={form.no_rm}
                onChange={e => setForm(f => ({ ...f, no_rm: e.target.value }))}
                required
                readOnly={!editing}
                className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm ${!editing ? 'bg-gray-50 text-gray-500 cursor-default' : ''}`}
              />
              {!editing && <p className="text-xs text-gray-400 mt-1">Digenerate otomatis</p>}
            </FormField>
            <FormField label="Nama" required>
              <input value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tanggal Lahir">
              <input type="date" value={form.tgl_lahir} onChange={e => setForm(f => ({ ...f, tgl_lahir: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </FormField>
            <FormField label="Jenis Kelamin">
              <select value={form.jenis_kelamin} onChange={e => setForm(f => ({ ...f, jenis_kelamin: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Bangsal">
              <select value={form.bangsal_id} onChange={e => handleBangsalChange(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Pilih bangsal</option>
                {bangsalList.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}
              </select>
            </FormField>
            <FormField label="Kamar">
              {kamarList.length > 0 ? (
                <select value={form.kamar} onChange={e => setForm(f => ({ ...f, kamar: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Pilih kamar</option>
                  {kamarList.map(k => <option key={k.id} value={k.nomor}>{k.bangsal} {k.nomor}</option>)}
                </select>
              ) : (
                <input value={form.kamar} onChange={e => setForm(f => ({ ...f, kamar: e.target.value }))} placeholder={form.bangsal_id ? 'Tidak ada kamar kosong' : 'Pilih bangsal dulu'} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              )}
            </FormField>
          </div>
          <FormField label="Diagnosa">
            <input value={form.diagnosa} onChange={e => setForm(f => ({ ...f, diagnosa: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </FormField>
          <FormField label="Alergi (pisahkan koma, mis: kacang, udang)">
            <input
              value={form.alergi}
              onChange={e => setForm(f => ({ ...f, alergi: e.target.value }))}
              list="saran-alergen-pasien"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="kacang, udang"
            />
            <datalist id="saran-alergen-pasien">
              {['kacang','udang','telur','susu','ikan','ayam','gluten','kedelai'].map(s => <option key={s} value={s} />)}
            </datalist>
            <p className="text-xs text-gray-400 mt-1">Alergi dicocokkan dengan nama menu, nama bahan, dan tag alergen.</p>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Jenis Diet">
              <select value={form.jenis_diet_id} onChange={e => setForm(f => ({ ...f, jenis_diet_id: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Pilih diet</option>
                {dietList.map(d => <option key={d.id} value={d.id}>{d.nama}</option>)}
              </select>
            </FormField>
            <FormField label="Status">
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="aktif">Aktif</option>
                <option value="pulang">Pulang</option>
              </select>
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Hapus Pasien" message={`Yakin hapus pasien "${deleting?.nama}"?`} onConfirm={handleDelete} onCancel={() => setDeleting(null)} loading={saving} />
    </div>
  )
}

