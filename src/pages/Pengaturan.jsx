import { useEffect, useState } from 'react'
import { getPengaturan, updatePengaturan, getProfiles, updateProfile } from '../services/pengaturanService'
import { getBangsal } from '../services/dietService'
import DataTable from '../components/ui/DataTable'
import PageHeader from '../components/ui/PageHeader'
import FormField from '../components/ui/FormField'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import toast from 'react-hot-toast'
import { Save, Pencil } from 'lucide-react'

const ROLE_OPTIONS = ['admin', 'ahli_gizi', 'koki', 'perawat', 'gudang']

export default function Pengaturan() {
  const [tab, setTab] = useState('config')
  const [settings, setSettings] = useState([])
  const [profiles, setProfiles] = useState([])
  const [bangsalList, setBangsalList] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Edit user modal
  const [editUser, setEditUser] = useState(null)
  const [formUser, setFormUser] = useState({ role: '', bangsal_id: '' })

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [s, p, b] = await Promise.all([getPengaturan(), getProfiles(), getBangsal()])
      setSettings(s)
      setProfiles(p)
      setBangsalList(b)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  function handleSettingChange(key, value) {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s))
  }

  async function saveSettings() {
    setSaving(true)
    try {
      for (const s of settings) {
        await updatePengaturan(s.key, s.value)
      }
      toast.success('Pengaturan disimpan')
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  function openEditUser(u) {
    setEditUser(u)
    setFormUser({ role: u.role, bangsal_id: u.bangsal_id ?? '' })
  }

  async function handleSaveUser(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfile(editUser.id, {
        role: formUser.role,
        bangsal_id: formUser.bangsal_id ? Number(formUser.bangsal_id) : null,
      })
      toast.success('User diperbarui')
      setEditUser(null)
      setLoading(true)
      await load()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const SETTING_LABELS = {
    cutoff_pagi: 'Cut-off Pagi',
    cutoff_siang: 'Cut-off Siang',
    cutoff_malam: 'Cut-off Malam',
    batas_hari_kedaluwarsa: 'Batas Hari Near-Expiry',
  }

  const colUser = [
    { key: 'nama', label: 'Nama' },
    { key: 'role', label: 'Role', render: r => <Badge color="info">{r.role}</Badge> },
    { key: 'bangsal', label: 'Bangsal', render: r => r.bangsal?.nama ?? '-' },
  ]

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div>
      <PageHeader title="Pengaturan" subtitle="Konfigurasi sistem dan kelola user" />

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('config')} className={`px-4 py-2 text-sm rounded-lg font-medium ${tab === 'config' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Konfigurasi</button>
        <button onClick={() => setTab('users')} className={`px-4 py-2 text-sm rounded-lg font-medium ${tab === 'users' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Kelola User</button>
      </div>

      {tab === 'config' ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md space-y-4">
          {settings.map(s => (
            <FormField key={s.key} label={SETTING_LABELS[s.key] || s.key}>
              <input value={s.value} onChange={e => handleSettingChange(s.key, e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </FormField>
          ))}
          <Button onClick={saveSettings} disabled={saving}>
            <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}
          </Button>
          <p className="text-xs text-gray-400">Batas kalori/natrium diatur di halaman Jenis Diet.</p>
        </div>
      ) : (
        <div>
          <p className="text-xs text-gray-500 mb-3">Pembuatan akun baru dilakukan di dashboard Supabase (Authentication → Users).</p>
          <DataTable columns={colUser} data={profiles} loading={false} searchKeys={['nama']}
            actions={row => (
              <Button variant="ghost" size="sm" onClick={() => openEditUser(row)}><Pencil size={14} /></Button>
            )}
          />
        </div>
      )}

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Edit User: ${editUser?.nama}`}>
        <form onSubmit={handleSaveUser} className="space-y-4">
          <FormField label="Role">
            <select value={formUser.role} onChange={e => setFormUser(f => ({ ...f, role: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </FormField>
          <FormField label="Bangsal">
            <select value={formUser.bangsal_id} onChange={e => setFormUser(f => ({ ...f, bangsal_id: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Tidak ada</option>
              {bangsalList.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}
            </select>
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditUser(null)}>Batal</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

