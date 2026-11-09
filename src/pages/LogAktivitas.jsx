import { useState, useEffect } from 'react'
import PageHeader from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import { supabase } from '../lib/supabaseClient'
import { formatTanggal } from '../lib/format'
import toast from 'react-hot-toast'

const WARNA_AKSI = {
  INSERT: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
}

export default function LogAktivitas() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalRow, setModalRow] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const { data: rows, error } = await supabase
        .from('log_aktivitas')
        .select('*, profiles(nama)')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      setData(rows || [])
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const cols = [
    { header: 'Waktu', key: row => formatTanggal(row.created_at?.slice(0,10)) + ' ' + row.created_at?.slice(11,16) },
    { header: 'Pengguna', key: row => row.profiles?.nama ?? row.user_id?.slice(0,8) },
    { header: 'Tabel', key: 'nama_tabel' },
    { header: 'Aksi', key: row => <Badge color={WARNA_AKSI[row.aksi] || 'gray'}>{row.aksi}</Badge> },
    { header: 'ID Baris', key: row => String(row.baris_id).slice(0,12) },
    {
      header: 'Detail',
      key: row => (
        <button
          onClick={() => setModalRow(row)}
          className="text-xs text-emerald-600 hover:underline"
        >
          Lihat
        </button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Log Aktivitas" />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <DataTable
          columns={cols}
          data={data}
          searchKeys={['nama_tabel', 'aksi', row => row.profiles?.nama ?? '']}
          pageSize={25}
        />
      )}

      {/* Modal diff */}
      {modalRow && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800">
                Detail — {modalRow.nama_tabel} {modalRow.aksi}
              </h3>
              <button onClick={() => setModalRow(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">SEBELUM</p>
                <pre className="bg-red-50 rounded-lg p-3 text-xs overflow-x-auto text-red-700 whitespace-pre-wrap">
                  {modalRow.data_lama ? JSON.stringify(modalRow.data_lama, null, 2) : '—'}
                </pre>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">SESUDAH</p>
                <pre className="bg-green-50 rounded-lg p-3 text-xs overflow-x-auto text-green-700 whitespace-pre-wrap">
                  {modalRow.data_baru ? JSON.stringify(modalRow.data_baru, null, 2) : '—'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

