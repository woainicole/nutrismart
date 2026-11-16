/**
 * sync_supabase_to_firebase.mjs
 *
 * Sinkronisasi: Firebase (AdmisiRS) → Supabase (NutriSmart)
 *
 * Yang disinkronkan:
 *   1. Pasien (Firestore pasien/ → Supabase pasien)
 *   2. Kamar  (Firestore kamar/ → Supabase kamar_integrasi)
 *   3. Jadwal Operasi (Firestore jadwalOperasi/ → Supabase jadwal_operasi_integrasi)
 *
 * Cara pakai:
 *   node scripts/sync_supabase_to_firebase.mjs
 *   node scripts/sync_supabase_to_firebase.mjs --only=pasien
 *   node scripts/sync_supabase_to_firebase.mjs --only=kamar
 *   node scripts/sync_supabase_to_firebase.mjs --only=operasi
 *
 * Prasyarat: node 18+
 * Catatan: Jalankan sekali untuk data awal. Setelah itu, data mengalir
 *          otomatis lewat ekstensi browser + RPC terima_event_integrasi.
 */

// ── Argumen ────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const onlyFlag = args.find(a => a.startsWith('--only='))?.split('=')[1]
const SYNC_PASIEN  = !onlyFlag || onlyFlag === 'pasien'
const SYNC_KAMAR   = !onlyFlag || onlyFlag === 'kamar'
const SYNC_OPERASI = !onlyFlag || onlyFlag === 'operasi'

// ── Konfigurasi ────────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://wkiiposeoztrdlpuzznh.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndraWlwb3Nlb3p0cmRscHV6em5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NDcyMzYsImV4cCI6MjEwOTAyMzIzNn0.ja_XQA6EZZ10LmzNA8PUnEAx3pjILyu_ChjDSFzQC8w'
const SUPABASE_EMAIL    = process.env.SUPABASE_SYNC_EMAIL    || 'admin@nutrismart.id'
const SUPABASE_PASSWORD = process.env.SUPABASE_SYNC_PASSWORD || 'admin123'

const FIREBASE_API_KEY    = 'AIzaSyCdZ-_H5-qyox3bH0PeeDgyBGxsLea0TT8'
const FIREBASE_PROJECT_ID = 'admisirs-app'
const FIREBASE_EMAIL      = process.env.FIREBASE_SYNC_EMAIL    || 'admin@admisi.id'
const FIREBASE_PASSWORD   = process.env.FIREBASE_SYNC_PASSWORD || 'admins123'

// ── Supabase helpers ───────────────────────────────────────────────────

async function loginSupabase() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: SUPABASE_EMAIL, password: SUPABASE_PASSWORD }),
  })
  const json = await res.json()
  if (!json.access_token) throw new Error(`Login Supabase gagal: ${json.error_description || json.message}`)
  return json.access_token
}

async function supabaseQuery(token, table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}&limit=200`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Supabase GET ${table} ${res.status}: ${await res.text()}`)
  return res.json()
}

async function supabaseUpsert(token, table, data, onConflict) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Supabase upsert ${table} ${res.status}: ${await res.text()}`)
}

// ── Firebase helpers ───────────────────────────────────────────────────

async function loginFirebase() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: FIREBASE_EMAIL, password: FIREBASE_PASSWORD, returnSecureToken: true }),
    }
  )
  const json = await res.json()
  if (!json.idToken) throw new Error(`Login Firebase gagal: ${json.error?.message}`)
  return json.idToken
}

async function getFirestoreKoleksi(koleksi, idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${koleksi}?pageSize=200`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } })
  if (!res.ok) throw new Error(`Firestore GET ${koleksi} ${res.status}: ${await res.text()}`)
  const json = await res.json()
  if (!json.documents) return []
  return json.documents.map(doc => {
    const id = doc.name.split('/').pop()
    return { _id: id, ...fsDocToObj(doc) }
  })
}

function fsDocToObj(doc) {
  const data = {}
  for (const [k, v] of Object.entries(doc.fields || {})) data[k] = fsValToJs(v)
  return data
}

function fsValToJs(val) {
  if (val.stringValue  !== undefined) return val.stringValue
  if (val.integerValue !== undefined) return Number(val.integerValue)
  if (val.booleanValue !== undefined) return val.booleanValue
  if (val.nullValue    !== undefined) return null
  if (val.arrayValue   !== undefined) return (val.arrayValue.values || []).map(fsValToJs)
  if (val.timestampValue !== undefined) return val.timestampValue
  if (val.mapValue !== undefined) {
    const obj = {}
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) obj[k] = fsValToJs(v)
    return obj
  }
  return null
}

// ── Pemetaan data ──────────────────────────────────────────────────────

const MAP_DIET = {
  'Normal':       'Normal', 'Diet DM':    'Diet DM', 'Rendah Garam': 'Rendah Garam',
  'Diet Lunak':   'Diet Lunak', 'Lunak':  'Diet Lunak',
  'Diet Cair':    'Diet Cair',  'Cair':   'Diet Cair',
  'Saring':       'Diet Lunak',
}

function pasienFirestoreKeSupabase(p) {
  return {
    no_rm:         p.noRm,
    nama:          p.nama,
    jenis_kelamin: p.jenisKelamin || 'L',
    tgl_lahir:     p.tglLahir     || null,
    kamar:         p.kamar        || '',
    diagnosa:      p.diagnosa     || '',
    alergi:        Array.isArray(p.alergi) ? p.alergi.map(a => String(a).trim().toLowerCase()) : [],
    status:        p.status === 'pulang' ? 'pulang' : 'aktif',
    tgl_masuk:     p.tglMasuk     || new Date().toISOString().slice(0, 10),
    tgl_pulang:    p.tglPulang    || null,
    perlu_operasi: !!p.perluOperasi,
  }
}

function kamarFirestoreKeSupabase(k) {
  return {
    firebase_id:  k._id,
    bangsal:      k.bangsal,
    nomor:        k.nomor,
    status:       k.status || 'kosong',
    pasien_no_rm: k.pasienId ? null : null,  // pasienId di Firestore adalah doc ID, bukan noRm
    sync_at:      new Date().toISOString(),
  }
}

function operasiFirestoreKeSupabase(o) {
  return {
    firebase_id:  o._id,
    no_rm:        o.noRm || '',
    nama_pasien:  o.namaPasien || '',
    tindakan:     o.tindakan || '',
    tanggal:      o.tanggal || new Date().toISOString().slice(0,10),
    jam:          o.jam || '00:00',
    dokter:       o.dokter || '',
    status:       ['terjadwal','selesai','batal'].includes(o.status) ? o.status : 'terjadwal',
    catatan:      o.catatan || '',
    sync_at:      new Date().toISOString(),
  }
}

// ── Fungsi utama ───────────────────────────────────────────────────────

async function main() {
  const bagian = [SYNC_PASIEN && 'pasien', SYNC_KAMAR && 'kamar', SYNC_OPERASI && 'operasi']
    .filter(Boolean).join(', ')
  console.log(`=== Sinkronisasi Firebase (AdmisiRS) → Supabase (NutriSmart) ===`)
  console.log(`    Yang disinkronkan: ${bagian}\n`)

  // Login
  console.log('🔑 Login ke Supabase...')
  const supaToken = await loginSupabase()
  console.log('   Supabase OK')

  console.log('🔑 Login ke Firebase...')
  const fbToken = await loginFirebase()
  console.log('   Firebase OK\n')

  const jeda = (ms) => new Promise(r => setTimeout(r, ms))

  // ── Sinkronisasi Pasien ──────────────────────────────────────────────
  if (SYNC_PASIEN) {
    console.log('👤 Sinkronisasi pasien...')
    const pasienFirestore = await getFirestoreKoleksi('pasien', fbToken)
    console.log(`   Ditemukan ${pasienFirestore.length} pasien di Firestore`)

    // Ambil bangsal_id mapping dari Supabase
    const bangsalList = await supabaseQuery(supaToken, 'bangsal', 'select=id,nama')
    const bangsalMap = {}
    for (const b of bangsalList) bangsalMap[b.nama] = b.id

    // Ambil jenis_diet_id mapping
    const dietList = await supabaseQuery(supaToken, 'jenis_diet', 'select=id,nama')
    const dietMap = {}
    for (const d of dietList) dietMap[d.nama] = d.id

    let ok = 0, gagal = 0
    for (const p of pasienFirestore) {
      if (!p.noRm) { gagal++; continue }
      try {
        const row = pasienFirestoreKeSupabase(p)
        // Tambahkan FK jika ada
        const bangsalNama = p.bangsal
        if (bangsalNama && bangsalMap[bangsalNama]) row.bangsal_id = bangsalMap[bangsalNama]
        const dietNama = MAP_DIET[p.dietAwal] || p.dietAwal
        if (dietNama && dietMap[dietNama]) row.jenis_diet_id = dietMap[dietNama]

        await supabaseUpsert(supaToken, 'pasien', row, 'no_rm')
        console.log(`   ✅ ${p.noRm} - ${p.nama}`)
        ok++
      } catch (e) {
        console.error(`   ❌ ${p.noRm}: ${e.message}`)
        gagal++
      }
      await jeda(80)
    }
    console.log(`   → ${ok} berhasil, ${gagal} gagal\n`)
  }

  // ── Sinkronisasi Kamar ───────────────────────────────────────────────
  if (SYNC_KAMAR) {
    console.log('🏠 Sinkronisasi kamar...')
    const kamarFirestore = await getFirestoreKoleksi('kamar', fbToken)
    console.log(`   Ditemukan ${kamarFirestore.length} kamar di Firestore`)

    // Untuk kamar yang terisi, cari no_rm pasiennya
    const pasienFirestore2 = SYNC_PASIEN ? [] : await getFirestoreKoleksi('pasien', fbToken)
    const pasienById = {}
    const sumberPasien = SYNC_PASIEN ? await getFirestoreKoleksi('pasien', fbToken) : pasienFirestore2
    for (const p of sumberPasien) if (p._id) pasienById[p._id] = p.noRm

    let ok = 0, gagal = 0
    for (const k of kamarFirestore) {
      try {
        const row = kamarFirestoreKeSupabase(k)
        // Resolve pasienId → noRm
        if (k.pasienId && pasienById[k.pasienId]) row.pasien_no_rm = pasienById[k.pasienId]
        await supabaseUpsert(supaToken, 'kamar_integrasi', row, 'firebase_id')
        console.log(`   ✅ ${k.bangsal} ${k.nomor} (${k.status})`)
        ok++
      } catch (e) {
        console.error(`   ❌ ${k.bangsal} ${k.nomor}: ${e.message}`)
        gagal++
      }
      await jeda(80)
    }
    console.log(`   → ${ok} berhasil, ${gagal} gagal\n`)
  }

  // ── Sinkronisasi Jadwal Operasi ──────────────────────────────────────
  if (SYNC_OPERASI) {
    console.log('🔪 Sinkronisasi jadwal operasi...')
    const operasiFirestore = await getFirestoreKoleksi('jadwalOperasi', fbToken)
    console.log(`   Ditemukan ${operasiFirestore.length} jadwal operasi di Firestore`)

    let ok = 0, gagal = 0
    for (const o of operasiFirestore) {
      try {
        const row = operasiFirestoreKeSupabase(o)
        await supabaseUpsert(supaToken, 'jadwal_operasi_integrasi', row, 'firebase_id')
        console.log(`   ✅ ${o.noRm} - ${o.tindakan} (${o.tanggal})`)
        ok++
      } catch (e) {
        console.error(`   ❌ ${o._id}: ${e.message}`)
        gagal++
      }
      await jeda(80)
    }
    console.log(`   → ${ok} berhasil, ${gagal} gagal\n`)
  }

  console.log('=== Selesai ===')
  console.log('Setelah ini, data mengalir otomatis lewat ekstensi browser.')
  console.log('Script ini hanya untuk sinkronisasi awal / refresh manual.')
}

main().catch(e => {
  console.error('\n💥 Error:', e.message)
  process.exit(1)
})
