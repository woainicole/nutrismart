import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'
import { getNotifikasi, getJumlahBelumDibaca, tandaiDibacaRute } from '../services/notifikasiService'
import toast from 'react-hot-toast'

const NotifikasiContext = createContext(null)

export function NotifikasiProvider({ children }) {
  const { session } = useAuth()
  const [notifs, setNotifs] = useState([])
  const [totalBelumDibaca, setTotalBelumDibaca] = useState(0)
  const [perRute, setPerRute] = useState({})

  const hitungPerRute = useCallback((rows) => {
    const acc = {}
    rows.forEach(r => {
      if (r.rute && !r.dibaca_at) {
        acc[r.rute] = (acc[r.rute] || 0) + 1
      }
    })
    setPerRute(acc)
  }, [])

  const refresh = useCallback(async () => {
    if (!session?.user) return
    try {
      const rows = await getNotifikasi(50)
      setNotifs(rows)
      hitungPerRute(rows)
      const count = await getJumlahBelumDibaca()
      setTotalBelumDibaca(count)
    } catch (e) {
      console.error('Gagal memuat notifikasi:', e.message)
    }
  }, [session, hitungPerRute])

  // Muat awal
  useEffect(() => {
    if (session?.user) refresh()
  }, [session, refresh])

  // Supabase Realtime subscribe
  useEffect(() => {
    if (!session?.user) return

    const channel = supabase
      .channel('notifikasi-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifikasi',
          filter: `penerima_id=eq.${session.user.id}`,
        },
        (payload) => {
          const baru = payload.new
          setNotifs(prev => [baru, ...prev].slice(0, 50))
          setTotalBelumDibaca(n => n + 1)
          if (baru.rute) {
            setPerRute(prev => ({ ...prev, [baru.rute]: (prev[baru.rute] || 0) + 1 }))
          }
          toast(baru.pesan, { icon: '🔔', duration: 4000 })
        }
      )
      .subscribe()

    // Polling fallback setiap 30 detik jika realtime gagal
    const timer = setInterval(refresh, 30_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [session, refresh])

  async function tandaiRute(rute) {
    try {
      await tandaiDibacaRute(rute)
      setNotifs(prev => prev.map(n => n.rute === rute ? { ...n, dibaca_at: new Date().toISOString() } : n))
      setPerRute(prev => { const next = { ...prev }; delete next[rute]; return next })
      const count = await getJumlahBelumDibaca()
      setTotalBelumDibaca(count)
    } catch (e) {
      console.error('Gagal tandai dibaca:', e.message)
    }
  }

  return (
    <NotifikasiContext.Provider value={{ notifs, totalBelumDibaca, perRute, refresh, tandaiRute }}>
      {children}
    </NotifikasiContext.Provider>
  )
}

export function useNotifikasi() {
  const ctx = useContext(NotifikasiContext)
  if (!ctx) throw new Error('useNotifikasi harus di dalam NotifikasiProvider')
  return ctx
}

