/**
 * sync_kamar_supabase_to_firebase.mjs
 *
 * Sinkronisasi SATU ARAH: Supabase kamar_integrasi → Firebase kamar
 *
 * Yang dilakukan:
 *   - Ambil semua kamar dari Supabase kamar_integrasi
 *   - Ambil semua pasien Firebase untuk mapping noRm → docId
 *   - Untuk tiap kamar Supabase: upsert ke Firebase collection kamar
 *     (match by bangsal+nomor, bukan firebase_id karena bisa null)
 *
 * Cara pakai:
 *   node scripts/sync_kamar_supabase_to_firebase.mjs
 *
 * Prasyarat: node 18+
 */

const SUPABASE_URL      = 'https://wkiiposeoztrdlpuzznh.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndraWlwb3Nlb3p0cmRscHV6em5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NDcyMzYsImV4cCI6MjEwOTAyMzIzNn0.ja_XQA6EZZ10LmzNA8PUnEAx3pjILyu_ChjDSFzQC8w'
const SUPABASE_EMAIL    = process.env.SUPABASE_SYNC_EMAIL    || 'admin@nutrismart.id'
const SUPABASE_PASSWORD = process.env.SUPABASE_SYNC_PASSWORD || 'admin123'

const FIREBASE_API_KEY    = 'AIzaSyCdZ-_H5-qyox3bH0PeeDgyBGxsLea0TT8'
const FIREBASE_PROJECT_ID = 'admisirs-app'
const FIREBASE_EMAIL      = process.env.FIREBASE_SYNC_EMAIL    || 'admin@admisi.id'
const FIREBASE_PASSWORD   = process.env.FIREBASE_SYNC_PASSWORD || 'admins123'

const jeda = ms => new Promise(r => setTimeout(r, ms))

// ── Login helpers ─────────────────────────────────────────────────────────

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

async function loginFirebase() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: FIREBASE_EMAIL, password: FIREBASE_PASSWORD, returnSecureToken: true }) }
  )
  const json = await res.json()
  if (!json.idToken) throw new Error(`Login Firebase gagal: ${json.error?.message}`)
  return json.idToken
}

// ── Supabase ──────────────────────────────────────────────────────────────

async function getKamarSupabase(token) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/kamar_integrasi?select=bangsal,nomor,status,pasien_no_rm,firebase_id&order=bangsal,nomor&limit=200`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error(`Supabase GET kamar_integrasi ${res.status}: ${await res.text()}`)
  return res.json()
}

async function updateFirebaseId(supaToken, bangsal, nomor, firebaseId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/kamar_integrasi?bangsal=eq.${encodeURIComponent(bangsal)}&nomor=eq.${encodeURIComponent(nomor)}`,
    {
      method: 'PATCH',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${supaToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ firebase_id: firebaseId }),
    }
  )
  if (!res.ok) console.warn(`  ⚠️  Gagal update firebase_id Supabase: ${await res.text()}`)
}

// ── Firebase ──────────────────────────────────────────────────────────────

async function getFirestoreKoleksi(koleksi, idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${koleksi}?pageSize=200`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } })
  if (!res.ok) throw new Error(`Firestore GET ${koleksi} ${res.status}: ${await res.text()}`)
  const json = await res.json()
  return (json.documents || []).map(doc => {
    const id = doc.name.split('/').pop()
    const fields = doc.fields || {}
    const get = k => fields[k]?.stringValue ?? fields[k]?.booleanValue ?? null
    return { _id: id, bangsal: get('bangsal'), nomor: get('nomor'), status: get('status'), pasienId: get('pasienId') }
  })
}

/** Patch satu dokumen Firestore (hanya field tertentu). */
async function firestorePatch(idToken, docId, fields) {
  const fieldMask = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&')
  const body = {
    fields: Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, v === null ? { nullValue: null } : { stringValue: String(v) }])
    )
  }
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/kamar/${docId}?${fieldMask}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Firestore PATCH kamar/${docId}: ${await res.text()}`)
}

/** Buat dokumen baru di Firestore (auto-id). */
async function firestoreCreate(idToken, fields) {
  const body = {
    fields: Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, v === null ? { nullValue: null } : { stringValue: String(v) }])
    )
  }
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/kamar`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Firestore CREATE kamar: ${await res.text()}`)
  const json = await res.json()
  return json.name.split('/').pop() // return new docId
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Sync Supabase kamar_integrasi → Firebase kamar ===\n')

  console.log('🔑 Login...')
  const [supaToken, fbToken] = await Promise.all([loginSupabase(), loginFirebase()])
  console.log('   OK\n')

  console.log('📦 Ambil data...')
  const [kamarSupa, kamarFB, pasienFB] = await Promise.all([
    getKamarSupabase(supaToken),
    getFirestoreKoleksi('kamar', fbToken),
    getFirestoreKoleksi('pasien', fbToken),
  ])
  console.log(`   Supabase: ${kamarSupa.length} kamar`)
  console.log(`   Firebase: ${kamarFB.length} kamar, ${pasienFB.length} pasien\n`)

  // Mapping noRm → Firebase docId
  const noRmToDocId = {}
  for (const p of pasienFB) if (p.bangsal !== null) {
    // pasienFB dari getFirestoreKoleksi — fields sudah dipetakan
  }
  // Re-fetch pasien dengan noRm field
  const rp = await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/pasien?pageSize=200`,
    { headers: { Authorization: `Bearer ${fbToken}` } }
  )
  const jp = await rp.json()
  for (const doc of jp.documents || []) {
    const docId = doc.name.split('/').pop()
    const noRm = doc.fields?.noRm?.stringValue
    if (noRm) noRmToDocId[noRm] = docId
  }
  console.log(`   Mapping noRm→docId: ${Object.keys(noRmToDocId).length} pasien\n`)

  // Index kamar Firebase by bangsal+nomor
  const fbIndex = {}
  for (const k of kamarFB) fbIndex[`${k.bangsal}|${k.nomor}`] = k

  let updated = 0, created = 0, skip = 0

  for (const k of kamarSupa) {
    const key = `${k.bangsal}|${k.nomor}`
    // Tentukan pasienId Firebase dari noRm
    const pasienDocId = k.pasien_no_rm ? (noRmToDocId[k.pasien_no_rm] || k.pasien_no_rm) : null
    const statusFB = k.status   // 'kosong' | 'terisi'

    const fbKamar = fbIndex[key]
    if (fbKamar) {
      // Kamar sudah ada di Firebase — cek apakah perlu update
      const statusSama = fbKamar.status === statusFB
      const pasienSama = fbKamar.pasienId === pasienDocId

      if (statusSama && pasienSama) {
        console.log(`   ⏭️  ${k.bangsal} ${k.nomor} sudah sinkron`)
        skip++
        continue
      }

      try {
        await firestorePatch(fbToken, fbKamar._id, { status: statusFB, pasienId: pasienDocId })
        console.log(`   ✅ Update ${k.bangsal} ${k.nomor}: status=${statusFB}, pasienId=${pasienDocId}`)
        updated++
      } catch (e) {
        console.error(`   ❌ Gagal update ${k.bangsal} ${k.nomor}: ${e.message}`)
      }
    } else {
      // Kamar belum ada di Firebase — buat baru
      try {
        const newDocId = await firestoreCreate(fbToken, {
          bangsal: k.bangsal, nomor: k.nomor,
          status: statusFB, pasienId: pasienDocId
        })
        console.log(`   ✅ Buat ${k.bangsal} ${k.nomor} (docId: ${newDocId})`)
        // Simpan firebase_id ke Supabase
        await updateFirebaseId(supaToken, k.bangsal, k.nomor, newDocId)
        created++
      } catch (e) {
        console.error(`   ❌ Gagal buat ${k.bangsal} ${k.nomor}: ${e.message}`)
      }
    }

    await jeda(100)
  }

  console.log(`\n=== Selesai: ${updated} diupdate, ${created} dibuat, ${skip} sudah sinkron ===`)
}

main().catch(e => { console.error('\n💥 Error:', e.message); process.exit(1) })
