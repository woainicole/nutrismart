/**
 * integrasiService.js — NutriSmart
 *
 * Menerima event masuk dari AdmisiRS (lewat ekstensi browser / simulator)
 * dan memancarkan event keluar (diet.diperbarui) ke ekstensi.
 *
 * Kontrak integrasi: admisiRS_plan.md Bagian 6 (jangan ubah sepihak).
 * RPC: terima_event_integrasi(jsonb) — Migration 19.
 */

import { supabase } from '../lib/supabaseClient'

// ─── Kosakata bersama (Bagian 6.3) ─────────────────────────────────────
export const CHANNEL = 'rs-integrasi'

export const JENIS_EVENT_VALID = new Set([
  'pasien.masuk',
  'pasien.diperbarui',
  'pasien.pulang',
  'operasi.dijadwalkan',
  'diet.diperbarui',
])

export const BANGSAL_VALID = new Set(['Melati', 'Mawar', 'VIP'])
export const DIET_VALID = new Set(['Normal', 'Diet DM', 'Rendah Garam', 'Diet Lunak', 'Diet Cair'])

// ─── Validasi lokal envelope (simetri dengan AdmisiRS validasiEvent) ───

/**
 * Validasi cepat sebelum mengirim ke RPC.
 * Mengembalikan { ok: boolean, pesan: string }
 */
export function validasiEventMasuk(event) {
  if (!event || typeof event !== 'object') return { ok: false, pesan: 'Event bukan objek.' }
  if (event.versi !== 1) return { ok: false, pesan: 'Versi event tidak dikenal: ' + event.versi }
  if (!event.eventId || typeof event.eventId !== 'string') return { ok: false, pesan: 'eventId wajib berupa string.' }
  if (!JENIS_EVENT_VALID.has(event.jenis)) return { ok: false, pesan: 'Jenis event tidak dikenal: ' + event.jenis }
  if (!['admisirs', 'nutrismart', 'simulator'].includes(event.sumber)) return { ok: false, pesan: 'Sumber tidak dikenal: ' + event.sumber }
  if (!event.data || typeof event.data !== 'object') return { ok: false, pesan: 'Field data harus berupa objek.' }

  const d = event.data
  if (['pasien.masuk', 'pasien.diperbarui'].includes(event.jenis)) {
    if (!d.noRm || !/^RM\d{3,}$/.test(d.noRm)) return { ok: false, pesan: 'noRm tidak valid: ' + d.noRm }
    if (!d.nama) return { ok: false, pesan: 'Field nama wajib diisi.' }
    if (!BANGSAL_VALID.has(d.bangsal)) return { ok: false, pesan: 'Bangsal tidak valid: ' + d.bangsal }
    if (!DIET_VALID.has(d.dietAwal)) return { ok: false, pesan: 'dietAwal tidak valid: ' + d.dietAwal }
  }
  if (event.jenis === 'pasien.pulang') {
    if (!d.noRm || !/^RM\d{3,}$/.test(d.noRm)) return { ok: false, pesan: 'noRm tidak valid: ' + d.noRm }
  }
  if (event.jenis === 'diet.diperbarui') {
    if (!d.noRm || !/^RM\d{3,}$/.test(d.noRm)) return { ok: false, pesan: 'noRm tidak valid: ' + d.noRm }
    if (!DIET_VALID.has(d.jenisDiet)) return { ok: false, pesan: 'jenisDiet tidak valid: ' + d.jenisDiet }
  }
  return { ok: true, pesan: 'Valid.' }
}

// ─── Terima event masuk (panggil RPC Supabase) ─────────────────────────

/**
 * Kirim event ke RPC terima_event_integrasi.
 * Mengembalikan { ok, pesan, status } dari RPC.
 */
export async function terimaEvent(event) {
  const validasi = validasiEventMasuk(event)
  if (!validasi.ok) {
    return { ok: false, pesan: validasi.pesan, status: 'gagal' }
  }

  const { data, error } = await supabase.rpc('terima_event_integrasi', { p_event: event })
  if (error) throw new Error('RPC error: ' + error.message)

  return data  // { ok, pesan, status?, noRm?, ... }
}

// ─── Ambil log integrasi ────────────────────────────────────────────────

export async function getIntegrasiLog(filter = {}) {
  let q = supabase
    .from('integrasi_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (filter.arah) q = q.eq('arah', filter.arah)
  if (filter.status) q = q.eq('status', filter.status)
  if (filter.jenis) q = q.eq('jenis', filter.jenis)
  if (filter.no_rm) q = q.eq('no_rm', filter.no_rm)

  const { data, error } = await q
  if (error) throw error
  return data
}

// ─── Emit event keluar (diet.diperbarui) ───────────────────────────────

// Firebase REST API untuk update Firestore AdmisiRS langsung (seamless, tanpa ekstensi)
const FB_PROJECT = import.meta.env.VITE_ADMISIRS_FIREBASE_PROJECT_ID
const FB_API_KEY = import.meta.env.VITE_ADMISIRS_FIREBASE_API_KEY

/**
 * Update dietSaatIni di Firestore AdmisiRS langsung via REST API.
 * Fallback jika gagal: tidak memblokir alur utama.
 */
async function updateDietAdmisiRS(noRm, jenisDiet) {
  if (!FB_PROJECT || !FB_API_KEY) return { ok: false, pesan: 'Konfigurasi Firebase AdmisiRS belum diisi.' }
  try {
    // Cari dokumen pasien by noRm via query
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents:runQuery?key=${FB_API_KEY}`
    const qRes = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'pasien' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'noRm' },
              op: 'EQUAL',
              value: { stringValue: noRm },
            },
          },
          limit: 1,
        },
      }),
    })
    const qData = await qRes.json()
    const doc = qData[0]?.document
    if (!doc) return { ok: false, pesan: `Pasien ${noRm} tidak ditemukan di AdmisiRS.` }

    // Patch dietSaatIni
    const docPath = doc.name  // sudah full path
    const patchUrl = `https://firestore.googleapis.com/v1/${docPath}?updateMask.fieldPaths=dietSaatIni&key=${FB_API_KEY}`
    const pRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { dietSaatIni: { stringValue: jenisDiet } } }),
    })
    if (!pRes.ok) {
      const teks = await pRes.text()
      return { ok: false, pesan: `Firestore error: ${teks}` }
    }
    return { ok: true, pesan: `Diet ${noRm} diperbarui di AdmisiRS menjadi "${jenisDiet}".` }
  } catch (e) {
    return { ok: false, pesan: 'Gagal menghubungi Firestore AdmisiRS: ' + e.message }
  }
}

/**
 * Setelah ahli gizi menyetujui pengajuan diet, panggil ini.
 * Memanggil RPC emit_diet_diperbarui, update Firestore AdmisiRS langsung (seamless),
 * dan emit envelope via postMessage (untuk ekstensi jika ada).
 *
 * @param {string} noRm - mis. 'RM001'
 * @param {string} jenisDiet - salah satu dari DIET_VALID
 * @param {string} [berlaku] - YYYY-MM-DD; default hari ini
 * @returns {{ envelope: object, admisirs: { ok, pesan } }}
 */
export async function emitDietDiperbarui(noRm, jenisDiet, berlaku) {
  const { data, error } = await supabase.rpc('emit_diet_diperbarui', {
    p_no_rm:      noRm,
    p_jenis_diet: jenisDiet,
    p_berlaku:    berlaku || new Date().toISOString().slice(0, 10),
  })
  if (error) throw new Error('RPC emit_diet_diperbarui error: ' + error.message)

  const envelope = data  // JSON envelope dari RPC

  // Update Firestore AdmisiRS langsung (seamless)
  const admisirs = await updateDietAdmisiRS(noRm, jenisDiet)

  // Juga emit postMessage agar ekstensi (jika ada) tetap bisa menangkap
  window.postMessage(
    { channel: CHANNEL, tipe: 'EVENT_KELUAR', event: envelope },
    window.location.origin
  )

  return { envelope, admisirs }
}

// ─── Listener postMessage (dipasang di IntegrasiContext) ────────────────

/**
 * Pasang listener postMessage sesuai Bagian 6.4 kontrak integrasi.
 * Mengembalikan fungsi cleanup (panggil saat unmount).
 *
 * @param {function} onEventMasuk - callback(event, kirimAck)
 */
export function pasangListenerIntegrasi(onEventMasuk) {
  async function handler(e) {
    // Aturan 1: abaikan jika bukan dari window yang sama atau channel salah
    if (e.source !== window) return
    if (!e.data || e.data.channel !== CHANNEL) return

    const { tipe, event } = e.data

    // Aturan 2: abaikan EVENT_KELUAR milik sendiri (itu untuk ekstensi)
    if (tipe === 'EVENT_KELUAR') return

    if (tipe !== 'EVENT_MASUK') return

    // Fungsi kirim ACK balik ke ekstensi
    const kirimAck = (ok, pesan) => {
      window.postMessage(
        { channel: CHANNEL, tipe: 'ACK', eventId: event?.eventId, ok, pesan },
        window.location.origin
      )
    }

    // Validasi cepat
    const v = validasiEventMasuk(event)
    if (!v.ok) {
      kirimAck(false, v.pesan)
      return
    }

    // Serahkan ke callback (IntegrasiContext yang memproses)
    onEventMasuk(event, kirimAck)
  }

  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}

// ─── Proses antrean dari sessionStorage (saat user belum login) ────────

const KUNCI_ANTREAN = 'antreanIntegrasi_nutrismart'

export function simpanKeAntrean(event) {
  const antrean = JSON.parse(sessionStorage.getItem(KUNCI_ANTREAN) || '[]')
  // Dedupe
  if (antrean.some(e => e.eventId === event.eventId)) return
  antrean.push(event)
  sessionStorage.setItem(KUNCI_ANTREAN, JSON.stringify(antrean))
}

export function ambilAntrean() {
  return JSON.parse(sessionStorage.getItem(KUNCI_ANTREAN) || '[]')
}

export function bersihkanAntrean() {
  sessionStorage.removeItem(KUNCI_ANTREAN)
}
