/**
 * IntegrasiContext.jsx — NutriSmart
 *
 * Context untuk:
 *  1. Mendengarkan event masuk dari AdmisiRS lewat postMessage (ekstensi browser)
 *  2. Mengelola antrean event saat user belum login
 *  3. Memanggil RPC terima_event_integrasi via integrasiService
 *
 * Kontrak: admisiRS_plan.md Bagian 6.4
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from './AuthContext'
import {
  ambilAntrean,
  bersihkanAntrean,
  pasangListenerIntegrasi,
  simpanKeAntrean,
  terimaEvent,
} from '../services/integrasiService'

const IntegrasiContext = createContext(null)

export function IntegrasiProvider({ children }) {
  const { session } = useAuth()
  const [logTerbaru, setLogTerbaru] = useState([])   // log lokal sesi ini (tambahan)
  const sedangProses = useRef(new Set())             // set eventId yang sedang diproses

  // ── Proses satu event masuk ──
  const prosesEvent = useCallback(async (event, kirimAck) => {
    // Hindari proses duplikat di sesi yang sama
    if (sedangProses.current.has(event.eventId)) return
    sedangProses.current.add(event.eventId)

    try {
      const hasil = await terimaEvent(event)
      kirimAck?.(hasil.ok, hasil.pesan)

      setLogTerbaru(prev => [
        { eventId: event.eventId, jenis: event.jenis, status: hasil.status || (hasil.ok ? 'diterima' : 'gagal'), pesan: hasil.pesan, waktu: new Date().toISOString() },
        ...prev.slice(0, 49),
      ])

      if (hasil.ok && hasil.status !== 'diabaikan') {
        toast.success(`Event ${event.jenis} diterima: ${hasil.pesan}`)
      } else if (!hasil.ok) {
        toast.error(`Event ${event.jenis} gagal: ${hasil.pesan}`)
      }
    } catch (err) {
      kirimAck?.(false, err.message)
      toast.error('Integrasi error: ' + err.message)
    } finally {
      sedangProses.current.delete(event.eventId)
    }
  }, [])

  // ── Pasang listener postMessage ──
  useEffect(() => {
    const cleanup = pasangListenerIntegrasi((event, kirimAck) => {
      if (!session) {
        // Belum login → simpan ke antrean
        simpanKeAntrean(event)
        toast('Event dari ekstensi disimpan. Proses setelah login.', { icon: '⏳' })
        kirimAck?.(true, 'Disimpan ke antrean, akan diproses setelah login.')
        return
      }
      prosesEvent(event, kirimAck)
    })
    return cleanup
  }, [session, prosesEvent])

  // ── Proses antrean setelah login ──
  useEffect(() => {
    if (!session) return
    const antrean = ambilAntrean()
    if (antrean.length === 0) return

    toast(`Memproses ${antrean.length} event tertunda...`, { icon: '🔄' })
    bersihkanAntrean()

    antrean.forEach(event => prosesEvent(event, null))
  }, [session, prosesEvent])

  return (
    <IntegrasiContext.Provider value={{ logTerbaru }}>
      {children}
    </IntegrasiContext.Provider>
  )
}

export function useIntegrasi() {
  const ctx = useContext(IntegrasiContext)
  if (!ctx) throw new Error('useIntegrasi harus dipakai di dalam IntegrasiProvider')
  return ctx
}
