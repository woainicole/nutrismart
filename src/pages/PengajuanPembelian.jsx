import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getPengajuanPembelian,
  createPengajuanPembelian,
  prosesStatusPembelian,
  terimaPembelianBarang,
  getBahanMenipis,
} from '../services/pengajuanService'
import { getBahan } from '../services/bahanService'
import { formatTanggal } from '../lib/format'
import DataTable from '../components/ui/DataTable'
import PageHeader from '../components/ui/PageHeader'
import Modal from '../components/ui/Modal'
import FormField from '../components/ui/FormField'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import toast from 'react-hot-toast'
import { Plus, Check, X, PackageCheck, Trash2, AlertTriangle, ShoppingCart } from 'lucide-react'

export default function PengajuanPembelian() {
  const { role } = useAuth()
  const [data, setData] = useState([])
  const [bahanList, setBahanList] = useState([])
  const [bahanMenipis, setBahanMenipis] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')

  // Modal Buat Pengajuan
  const [modalOpen, setModalOpen] = useState(false)
  const [formCatatan, setFormCatatan] = useState('')
  const [formItems, setFormItems] = useState([])
  const [saving, setSaving] = useState(false)

  // Modal Terima Barang
  const [terimaModalOpen, setTerimaModalOpen] = useState(false)
  const [activePengajuan, setActivePengajuan] = useState(null)
  const [terimaItems, setTerimaItems] = useState([])
  const [processingTerima, setProcessingTerima] = useState(false)

  const canCreate = ['admin', 'koki'].includes(role)
  const canApprove = ['admin', 'gudang'].includes(role)

  useEffect(() => {
    load()
  }, [filterStatus])

  async function load() {
    setLoading(true)
    try {
      const filter = filterStatus ? { status: filterStatus } : {}
      const [pembelianData, bahanData, menipisData] = await Promise.all([
        getPengajuanPembelian(filter),
        getBahan(),
        getBahanMenipis(),
      ])
      setData(pembelianData)
      setBahanList(bahanData)
      setBahanMenipis(menipisData)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  function openCreateModal() {
    setFormCatatan('')
    // Default 1 item kosong
    setFormItems([{ bahan_id: bahanList[0]?.id || '', jumlah: 1 }])
    setModalOpen(true)
  }

  function addEmptyItem() {
    const defaultBahan = bahanList[0]?.id || ''
    setFormItems(prev => [...prev, { bahan_id: defaultBahan, jumlah: 1 }])
  }

  function removeItem(index) {
    setFormItems(prev => prev.filter((_, i) => i !== index))
  }

  function updateItem(index, field, value) {
    setFormItems(prev =>
      prev.map((it, i) => (i === index ? { ...it, [field]: value } : it))
    )
  }

  function applySaranBahan(b) {
    // Hitung kekurangan kuantitas
    const kebutuhan = Math.max(1, Number(b.stok_minimum) - Number(b.stok_total))
    // Cek apakah bahan sudah ada di list
    const existingIndex = formItems.findIndex(it => Number(it.bahan_id) === Number(b.id))
    if (existingIndex >= 0) {
      updateItem(existingIndex, 'jumlah', kebutuhan)
      toast.success(`Jumlah ${b.nama} diperbarui ke ${kebutuhan} ${b.satuan}`)
    } else {
      setFormItems(prev => [...prev, { bahan_id: b.id, jumlah: kebutuhan }])
      toast.success(`${b.nama} ditambahkan ke pengajuan`)
    }
  }

  async function handleCreateSubmit(e) {
    e.preventDefault()
    if (formItems.length === 0) {
      toast.error('Tambahkan minimal 1 bahan makanan')
      return
    }

    for (const it of formItems) {
      if (!it.bahan_id || Number(it.jumlah) <= 0) {
        toast.error('Pastikan semua bahan dan jumlah (> 0) telah terisi dengan benar')
        return
      }
    }

    setSaving(true)
    try {
      await createPengajuanPembelian({
        catatan: formCatatan,
        items: formItems,
      })
      toast.success('Pengajuan pembelian berhasil dibuat')
      setModalOpen(false)
      await load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSetujui(id) {
    try {
      await prosesStatusPembelian(id, 'disetujui')
      toast.success('Pengajuan pembelian disetujui')
      await load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function handleTolak(id) {
    try {
      await prosesStatusPembelian(id, 'ditolak')
      toast.success('Pengajuan pembelian ditolak')
      await load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  function openTerimaModal(pengajuan) {
    setActivePengajuan(pengajuan)
    // Setup item dengan default tanggal kedaluwarsa 30 hari ke depan
    const defaultDate = new Date()
    defaultDate.setDate(defaultDate.getDate() + 30)
    const formattedDate = defaultDate.toISOString().split('T')[0]

    const initial = (pengajuan.items || []).map(it => ({
      bahan_id: it.bahan_id,
      nama: it.bahan?.nama,
      satuan: it.bahan?.satuan,
      jumlah: it.jumlah,
      tgl_kedaluwarsa: formattedDate,
    }))
    setTerimaItems(initial)
    setTerimaModalOpen(true)
  }

  async function handleTerimaSubmit(e) {
    e.preventDefault()
    if (!activePengajuan) return

    for (const it of terimaItems) {
      if (!it.tgl_kedaluwarsa) {
        toast.error(`Tanggal kedaluwarsa untuk ${it.nama} wajib diisi`)
        return
      }
    }

    setProcessingTerima(true)
    try {
      const payload = terimaItems.map(it => ({
        bahan_id: it.bahan_id,
        jumlah: it.jumlah,
        tgl_kedaluwarsa: it.tgl_kedaluwarsa,
      }))

      await terimaPembelianBarang(activePengajuan.id, payload)
      toast.success('Barang diterima! Batch stok baru otomatis dibuat')
      setTerimaModalOpen(false)
      await load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setProcessingTerima(false)
    }
  }

  const columns = [
    {
      key: 'created_at',
      label: 'Tanggal',
      render: r => formatTanggal(r.created_at),
    },
    {
      key: 'pengaju',
      label: 'Diajukan Oleh',
      render: r => r.pengaju?.nama || '-',
    },
    {
      key: 'items',
      label: 'Daftar Bahan & Jumlah',
      render: r => (
        <div className="space-y-1">
          {r.items && r.items.length > 0 ? (
            r.items.map((it, idx) => (
              <div key={idx} className="text-xs text-gray-700">
                • <span className="font-medium">{it.bahan?.nama}</span>: {it.jumlah} {it.bahan?.satuan}
              </div>
            ))
          ) : (
            <span className="text-xs text-gray-400">Tidak ada item</span>
          )}
        </div>
      ),
    },
    {
      key: 'catatan',
      label: 'Catatan',
      render: r => r.catatan || <span className="text-gray-400">-</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: r => <Badge color={r.status}>{r.status}</Badge>,
    },
    {
      key: 'aksi',
      label: 'Aksi',
      render: r => (
        <div className="flex items-center gap-1.5 flex-wrap">
          {r.status === 'menunggu' && canApprove && (
            <>
              <button
                onClick={() => handleSetujui(r.id)}
                title="Setujui Pengajuan"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded transition"
              >
                <Check size={14} /> Setujui
              </button>
              <button
                onClick={() => handleTolak(r.id)}
                title="Tolak Pengajuan"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition"
              >
                <X size={14} /> Tolak
              </button>
            </>
          )}

          {r.status === 'disetujui' && canApprove && (
            <button
              onClick={() => openTerimaModal(r)}
              title="Terima Barang & Masuk Stok"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition"
            >
              <PackageCheck size={14} /> Terima Barang
            </button>
          )}

          {r.status === 'diterima' && (
            <span className="text-xs text-emerald-600 font-medium">Stok Masuk ✓</span>
          )}

          {r.status === 'ditolak' && (
            <span className="text-xs text-red-500 font-medium">Ditolak</span>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Pengajuan Pembelian Bahan"
        subtitle="Kelola pengadaan stok bahan makanan antara bagian Dapur dan Gudang"
        action={
          canCreate && (
            <Button onClick={openCreateModal}>
              <Plus size={16} /> Ajukan Pembelian
            </Button>
          )
        }
      />

      {/* Banner Saran Bahan Menipis */}
      {bahanMenipis.length > 0 && canCreate && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-900">
                Peringatan: {bahanMenipis.length} Bahan Makanan Berada di Bawah Stok Minimum
              </h4>
              <p className="text-xs text-amber-700 mt-0.5">
                Bahan berikut menipis di gudang dan disarankan untuk segera diajukan pembelian:
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {bahanMenipis.map(b => (
                  <button
                    key={b.id}
                    onClick={() => {
                      openCreateModal()
                      applySaranBahan(b)
                    }}
                    className="inline-flex items-center gap-1 text-xs bg-white text-amber-800 border border-amber-300 px-2.5 py-1 rounded hover:bg-amber-100 transition"
                  >
                    <Plus size={12} /> {b.nama} (Sisa: {b.stok_total} / Min: {b.stok_minimum} {b.satuan})
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Status */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500">Filter Status:</span>
        {['', 'menunggu', 'disetujui', 'diterima', 'ditolak'].map(st => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition ${
              filterStatus === st
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {st || 'Semua'}
          </button>
        ))}
      </div>

      {/* Tabel Pengajuan */}
      {data.length === 0 && !loading ? (
        <EmptyState
          icon={ShoppingCart}
          title="Belum Ada Pengajuan Pembelian"
          description="Pengajuan pembelian bahan makanan dari koki atau gudang akan muncul di sini."
          action={
            canCreate && (
              <Button onClick={openCreateModal}>
                <Plus size={16} /> Buat Pengajuan Sekarang
              </Button>
            )
          }
        />
      ) : (
        <DataTable columns={columns} data={data} loading={loading} />
      )}

      {/* Modal Buat Pengajuan Pembelian */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Form Pengajuan Pembelian Bahan"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {/* Saran Otomatis di Dalam Modal */}
          {bahanMenipis.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <span className="text-xs font-semibold text-amber-900 block mb-1">
                💡 Saran Cepat: Bahan di Bawah Minimum
              </span>
              <div className="flex flex-wrap gap-1.5">
                {bahanMenipis.map(b => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => applySaranBahan(b)}
                    className="text-xs bg-white text-amber-800 border border-amber-300 px-2 py-0.5 rounded hover:bg-amber-100"
                  >
                    + {b.nama}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-gray-700">
                Daftar Bahan yang Dipesan *
              </label>
              <button
                type="button"
                onClick={addEmptyItem}
                className="text-xs text-emerald-700 font-medium hover:underline flex items-center gap-1"
              >
                <Plus size={14} /> Tambah Baris
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto p-1 border border-gray-100 rounded-md">
              {formItems.map((item, idx) => {
                const selectedBahan = bahanList.find(b => Number(b.id) === Number(item.bahan_id))
                return (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                    <div className="flex-1">
                      <select
                        value={item.bahan_id}
                        onChange={e => updateItem(idx, 'bahan_id', e.target.value)}
                        className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 bg-white"
                        required
                      >
                        {bahanList.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.nama} ({b.satuan})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-24">
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        value={item.jumlah}
                        onChange={e => updateItem(idx, 'jumlah', e.target.value)}
                        placeholder="Jumlah"
                        className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 bg-white text-right"
                        required
                      />
                    </div>

                    <div className="w-14 text-xs text-gray-500 truncate">
                      {selectedBahan?.satuan || ''}
                    </div>

                    {formItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Hapus Baris"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <FormField label="Catatan Tambahan (Opsional)">
            <textarea
              rows={2}
              value={formCatatan}
              onChange={e => setFormCatatan(e.target.value)}
              placeholder="Contoh: Stok beras diperkirakan habis dalam 2 hari ke depan"
              className="w-full text-sm border border-gray-300 rounded-md p-2"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Kirim Pengajuan'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Terima Barang (Gudang/Admin) */}
      <Modal
        open={terimaModalOpen}
        onClose={() => setTerimaModalOpen(false)}
        title="Konfirmasi Penerimaan Barang & Batch Stok"
      >
        <form onSubmit={handleTerimaSubmit} className="space-y-4">
          <p className="text-xs text-gray-600">
            Pastikan barang fisik yang tiba sesuai pesanan. Masukkan tanggal kedaluwarsa untuk setiap
            bahan agar sistem dapat mencatat batch stok (FEFO) dengan akurat.
          </p>

          <div className="space-y-3 max-h-72 overflow-y-auto">
            {terimaItems.map((item, idx) => (
              <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded-md space-y-2">
                <div className="flex justify-between items-center text-sm font-semibold text-gray-800">
                  <span>{item.nama}</span>
                  <span className="text-emerald-700">
                    {item.jumlah} {item.satuan}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-600 w-36 shrink-0">
                    Tgl Kedaluwarsa *:
                  </label>
                  <input
                    type="date"
                    required
                    value={item.tgl_kedaluwarsa}
                    onChange={e => {
                      const val = e.target.value
                      setTerimaItems(prev =>
                        prev.map((it, i) => (i === idx ? { ...it, tgl_kedaluwarsa: val } : it))
                      )
                    }}
                    className="flex-1 text-xs border border-gray-300 rounded px-2.5 py-1.5 bg-white"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setTerimaModalOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={processingTerima}>
              {processingTerima ? 'Memproses Batch...' : 'Terima & Tambah ke Stok'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

