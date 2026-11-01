import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { isViewOnly } from '../lib/roles'
import { useLocation } from 'react-router-dom'
import { getMenuHarian, upsertMenuHarian } from '../services/menuHarianService'
import { getJenisDiet } from '../services/dietService'
import { getMenu } from '../services/menuService'
import { hariIni, formatTanggalLengkap } from '../lib/format'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import toast from 'react-hot-toast'
import { Save } from 'lucide-react'

const WAKTU = ['pagi', 'siang', 'malam']

export default function MenuHarian() {
  const { role } = useAuth()
  const viewOnly = isViewOnly(role, useLocation().pathname)
  const [tanggal, setTanggal] = useState(hariIni())
  const [dietList, setDietList] = useState([])
  const [menuList, setMenuList] = useState([])
  const [grid, setGrid] = useState({}) // key: `${diet_id}_${waktu}` => menu_id
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [tanggal])

  async function loadData() {
    setLoading(true)
    try {
      const [diets, menus, existing] = await Promise.all([
        getJenisDiet(),
        getMenu(),
        getMenuHarian(tanggal),
      ])
      setDietList(diets)
      setMenuList(menus)

      // Bangun grid dari data existing
      const g = {}
      for (const mh of existing) {
        g[`${mh.jenis_diet_id}_${mh.waktu_makan}`] = String(mh.menu_id)
      }
      setGrid(g)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  function handleChange(dietId, waktu, menuId) {
    setGrid(prev => ({ ...prev, [`${dietId}_${waktu}`]: menuId }))
  }

  // Menu yang cocok untuk diet tertentu (cek menu_diet relasi)
  function menuUntukDiet(dietId) {
    return menuList.filter(m =>
      m.menu_diet?.some(md => md.jenis_diet_id === dietId)
    )
  }

  async function handleSave() {
    setSaving(true)
    try {
      const items = []
      for (const diet of dietList) {
        for (const w of WAKTU) {
          const menuId = grid[`${diet.id}_${w}`]
          if (menuId) {
            items.push({
              tanggal,
              waktu_makan: w,
              jenis_diet_id: diet.id,
              menu_id: Number(menuId),
            })
          }
        }
      }
      if (items.length === 0) {
        toast.error('Belum ada menu yang dipilih')
        return
      }
      await upsertMenuHarian(items)
      toast.success('Menu harian berhasil disimpan')
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Menu Harian" subtitle="Atur menu per diet per waktu makan" />

      {/* Pilih tanggal */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="date"
          value={tanggal}
          onChange={e => setTanggal(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <span className="text-sm text-gray-500">{formatTanggalLengkap(tanggal)}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <>
          <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Diet</th>
                  {WAKTU.map(w => (
                    <th key={w} className="text-left px-4 py-3 text-xs text-gray-500 uppercase capitalize">{w}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dietList.map(diet => (
                  <tr key={diet.id} className="border-b border-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-700">{diet.nama}</td>
                    {WAKTU.map(w => {
                      const menus = menuUntukDiet(diet.id)
                      const val = grid[`${diet.id}_${w}`] || ''
                      return (
                        <td key={w} className="px-4 py-3">
                          <select
                            value={val}
                            onChange={e => handleChange(diet.id, w, e.target.value)}
                            disabled={viewOnly}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm disabled:bg-gray-50"
                          >
                            <option value="">— Pilih menu —</option>
                            {menus.map(m => (
                              <option key={m.id} value={m.id}>{m.nama}</option>
                            ))}
                          </select>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!viewOnly && (
            <div className="flex justify-end mt-4">
              <Button onClick={handleSave} disabled={saving}>
                <Save size={16} />
                {saving ? 'Menyimpan...' : 'Simpan Menu Harian'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

