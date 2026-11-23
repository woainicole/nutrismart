import { useState, useRef, useEffect } from 'react'
import { Menu, LogOut, Bell } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useNotifikasi } from '../../context/NotifikasiContext'
import { useNavigate } from 'react-router-dom'
import { tandaiDibaca, tandaiSemuaDibaca } from '../../services/notifikasiService'
import toast from 'react-hot-toast'

export default function Topbar({ onToggleSidebar }) {
  const { signOut, profile } = useAuth()
  const { notifs, totalBelumDibaca, refresh, tandaiRute } = useNotifikasi()
  const navigate = useNavigate()
  const [openBell, setOpenBell] = useState(false)
  const bellRef = useRef(null)

  // Tutup dropdown klik luar
  useEffect(() => {
    function handleClick(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) setOpenBell(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleLogout() {
    await signOut()
    toast.success('Berhasil keluar')
    navigate('/login', { replace: true })
  }

  async function handleClickNotif(n) {
    setOpenBell(false)
    if (n.rute) {
      // tandaiRute handles optimistic update + DB in one call, clears sidebar badge too
      await tandaiRute(n.rute)
      navigate(n.rute)
    } else if (!n.dibaca_at) {
      await tandaiDibaca([n.id])
      refresh()
    }
  }

  async function handleTandaiSemua() {
    try {
      await tandaiSemuaDibaca()
      refresh()
    } catch (e) { toast.error(e.message) }
  }

  const badge = totalBelumDibaca > 99 ? '99+' : totalBelumDibaca
  const preview = notifs.slice(0, 15)

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
      <button
        onClick={onToggleSidebar}
        className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
      >
        <Menu size={20} />
      </button>

      <div className="lg:flex-1" />

      <div className="flex items-center gap-3">
        {/* Bell notifikasi */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => setOpenBell(o => !o)}
            className="relative p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
            title="Notifikasi"
          >
            <Bell size={20} />
            {totalBelumDibaca > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-0.5 font-bold leading-none">
                {badge}
              </span>
            )}
          </button>

          {openBell && (
            <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-700">Notifikasi</span>
                {totalBelumDibaca > 0 && (
                  <button onClick={handleTandaiSemua} className="text-xs text-emerald-600 hover:underline">
                    Tandai semua dibaca
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {preview.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Tidak ada notifikasi</p>
                ) : preview.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleClickNotif(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${!n.dibaca_at ? 'bg-blue-50' : ''}`}
                  >
                    <p className="text-sm text-gray-800 line-clamp-2">{n.pesan}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{n.created_at?.slice(0,16).replace('T', ' ')}</p>
                  </button>
                ))}
              </div>
              <div className="border-t border-gray-100 px-4 py-2">
                <button
                  onClick={() => { setOpenBell(false); navigate('/notifikasi') }}
                  className="text-sm text-emerald-600 hover:underline w-full text-center"
                >
                  Lihat semua
                </button>
              </div>
            </div>
          )}
        </div>

        <span className="text-sm text-gray-600 hidden sm:block">{profile?.nama}</span>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
          title="Keluar"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </header>
  )
}


