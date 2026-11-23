/**
 * sync_kamar_lengkap.mjs
 *
 * Sinkronisasi Komprehensif Kamar: Supabase (Pasien & kamar_integrasi) <-> Firebase (kamar & pasien)
 *
 * Fitur:
 * 1. Ambil seluruh pasien Supabase dan petakan kamar aktualnya.
 * 2. Susun daftar seluruh kamar RS (Melati, Mawar, VIP) dari pasien + master.
 * 3. Upsert ke Supabase `kamar_integrasi` (status terisi/kosong + pasien_no_rm).
 * 4. Sinkronkan ke Firebase collection `kamar`:
 *    - Update kamar yang sudah ada (status dan pasienId dokumen Firestore).
 *    - Buat kamar yang belum ada.
 * 5. Update `kamarId` pada dokumen `pasien` di Firestore agar sinkron dua arah.
 * 6. Simpan `firebase_id` kamar ke Supabase `kamar_integrasi`.
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

// ── Firestore REST API Helpers ─────────────────────────────────────────────

async function getFirestoreDocs(koleksi, idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${koleksi}?pageSize=200`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } })
  if (!res.ok) throw new Error(`Firestore GET ${koleksi}: ${await res.text()}`)
  const json = await res.json()
  return (json.documents || []).map(doc => {
    const id = doc.name.split('/').pop()
    const fields = doc.fields || {}
    const getStr = k => fields[k]?.stringValue ?? null
    return { _id: id, ...fields, getStr }
  })
}

async function patchFirestoreDoc(idToken, koleksi, docId, fields) {
  const fieldMask = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&')
  const body = {
    fields: Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [
        k,
        v === null ? { nullValue: null } : { stringValue: String(v) }
      ])
    )
  }
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${koleksi}/${docId}?${fieldMask}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Firestore PATCH ${koleksi}/${docId}: ${await res.text()}`)
  return res.json()
}

async function createFirestoreDoc(idToken, koleksi, fields) {
  const body = {
    fields: Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [
        k,
        v === null ? { nullValue: null } : { stringValue: String(v) }
      ])
    )
  }
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${koleksi}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Firestore CREATE ${koleksi}: ${await res.text()}`)
  const json = await res.json()
  return json.name.split('/').pop()
}

// ── Supabase Helpers ────────────────────────────────────────────────────────

async function upsertKamarSupabase(supaToken, kamarItem) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/kamar_integrasi?on_conflict=bangsal,nomor`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${supaToken}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(kamarItem),
  })
  if (!res.ok) throw new Error(`Supabase upsert kamar_integrasi: ${await res.text()}`)
  return res.json()
}

async function main() {
  console.log('=================================================================')
  console.log('🔄 SINKRONISASI LENGKAP KAMAR & PENGHUNI (SUPABASE <-> FIREBASE)')
  console.log('=================================================================\n')

  console.log('1️⃣  Login ke Supabase & Firebase...')
  const [supaToken, fbToken] = await Promise.all([loginSupabase(), loginFirebase()])
  console.log('    ✓ Login berhasil.\n')

  console.log('2️⃣  Mengambil data pasien dari Supabase...')
  const resPasienSupa = await fetch(
    `${SUPABASE_URL}/rest/v1/pasien?select=no_rm,nama,kamar,status,bangsal:bangsal_id(nama)&order=no_rm`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${supaToken}` } }
  )
  const pasienSupa = await resPasienSupa.json()
  console.log(`    ✓ ${pasienSupa.length} pasien ditemukan di Supabase.`)

  console.log('3️⃣  Mengambil data pasien & kamar dari Firebase Firestore...')
  const [rawKamarFB, rawPasienFB] = await Promise.all([
    getFirestoreDocs('kamar', fbToken),
    getFirestoreDocs('pasien', fbToken),
  ])
  console.log(`    ✓ Firestore: ${rawKamarFB.length} kamar, ${rawPasienFB.length} pasien.`)

  // Buat index pasien Firebase: noRm -> { id, ... }
  const fbPasienByNoRm = {}
  for (const p of rawPasienFB) {
    const noRm = p.noRm?.stringValue
    if (noRm) fbPasienByNoRm[noRm] = { id: p._id, ...p }
  }

  // Buat index kamar Firebase: "bangsal|nomor" -> { id, ... }
  const fbKamarByKey = {}
  for (const k of rawKamarFB) {
    const b = k.bangsal?.stringValue
    const n = k.nomor?.stringValue
    if (b && n) fbKamarByKey[`${b}|${n}`] = { id: k._id, ...k }
  }

  // Petakan kamar aktif dari pasien Supabase
  // { 'bangsal|nomor': { bangsal, nomor, pasien_no_rm, status: 'terisi' } }
  const kamarMaster = new Map()

  // Daftarkan kamar dasar standar rumah sakit
  const standardRooms = [
    // Melati
    { bangsal: 'Melati', nomor: '101A' }, { bangsal: 'Melati', nomor: '101B' },
    { bangsal: 'Melati', nomor: '102A' }, { bangsal: 'Melati', nomor: '102B' },
    { bangsal: 'Melati', nomor: '103A' }, { bangsal: 'Melati', nomor: '103B' },
    { bangsal: 'Melati', nomor: '104A' }, { bangsal: 'Melati', nomor: '104B' },
    // Mawar
    { bangsal: 'Mawar', nomor: '201A' }, { bangsal: 'Mawar', nomor: '201B' },
    { bangsal: 'Mawar', nomor: '202A' }, { bangsal: 'Mawar', nomor: '202B' },
    { bangsal: 'Mawar', nomor: '203A' }, { bangsal: 'Mawar', nomor: '203B' },
    { bangsal: 'Mawar', nomor: '204A' }, { bangsal: 'Mawar', nomor: '204B' },
    // VIP
    { bangsal: 'VIP', nomor: '301' }, { bangsal: 'VIP', nomor: '302' },
    { bangsal: 'VIP', nomor: '303' }, { bangsal: 'VIP', nomor: '304' },
    { bangsal: 'VIP', nomor: '305' }, { bangsal: 'VIP', nomor: '306' },
    { bangsal: 'VIP', nomor: '307' }, { bangsal: 'VIP', nomor: '308' },
  ]

  for (const r of standardRooms) {
    kamarMaster.set(`${r.bangsal}|${r.nomor}`, {
      bangsal: r.bangsal,
      nomor: r.nomor,
      status: 'kosong',
      pasien_no_rm: null,
    })
  }

  // Sekarang isi dari data pasien Supabase yang aktif
  for (const p of pasienSupa) {
    const bangsal = p.bangsal?.nama
    const nomor = p.kamar?.trim()
    if (!bangsal || !nomor) continue

    const key = `${bangsal}|${nomor}`
    const isAktif = p.status === 'aktif'

    if (isAktif) {
      kamarMaster.set(key, {
        bangsal,
        nomor,
        status: 'terisi',
        pasien_no_rm: p.no_rm,
      })
    } else if (!kamarMaster.has(key)) {
      kamarMaster.set(key, {
        bangsal,
        nomor,
        status: 'kosong',
        pasien_no_rm: null,
      })
    }
  }

  console.log(`\n4️⃣  Total kamar terpetakan: ${kamarMaster.size} kamar. Memproses ke Firebase & Supabase...\n`)

  let countUpdatedFB = 0
  let countCreatedFB = 0
  let countKamarIdLinked = 0

  for (const [key, dataKamar] of kamarMaster.entries()) {
    const { bangsal, nomor, status, pasien_no_rm } = dataKamar
    const fbExisting = fbKamarByKey[key]

    // Tentukan pasienDocId di Firebase
    let fbPasienId = null
    if (status === 'terisi' && pasien_no_rm) {
      const pFB = fbPasienByNoRm[pasien_no_rm]
      fbPasienId = pFB ? pFB.id : pasien_no_rm
    }

    let finalKamarDocId = null

    if (fbExisting) {
      finalKamarDocId = fbExisting.id
      const curStatus = fbExisting.status?.stringValue
      const curPasienId = fbExisting.pasienId?.stringValue ?? null

      if (curStatus !== status || curPasienId !== fbPasienId) {
        await patchFirestoreDoc(fbToken, 'kamar', finalKamarDocId, {
          status,
          pasienId: fbPasienId,
        })
        console.log(`  ✓ Firebase UPDATE kamar ${bangsal} ${nomor}: ${status} (pasien: ${pasien_no_rm || '-'})`)
        countUpdatedFB++
      }
    } else {
      // Kamar belum ada di Firebase -> buat baru
      finalKamarDocId = await createFirestoreDoc(fbToken, 'kamar', {
        bangsal,
        nomor,
        status,
        pasienId: fbPasienId,
      })
      console.log(`  ✨ Firebase CREATE kamar ${bangsal} ${nomor} (id: ${finalKamarDocId}): ${status}`)
      countCreatedFB++
    }

    // Link kamarId di dokumen pasien Firebase jika ada pasiennya
    if (status === 'terisi' && pasien_no_rm) {
      const pFB = fbPasienByNoRm[pasien_no_rm]
      if (pFB && pFB.kamarId?.stringValue !== finalKamarDocId) {
        await patchFirestoreDoc(fbToken, 'pasien', pFB.id, {
          kamarId: finalKamarDocId,
          bangsal,
          kamar: nomor,
        })
        countKamarIdLinked++
      }
    }

    // Upsert ke Supabase kamar_integrasi
    await upsertKamarSupabase(supaToken, {
      bangsal,
      nomor,
      status,
      pasien_no_rm,
      firebase_id: finalKamarDocId,
      sync_at: new Date().toISOString(),
    })

    await jeda(80)
  }

  console.log('\n=================================================================')
  console.log(`✅ SINKRONISASI SELESAI!`)
  console.log(`   - Total kamar di Supabase kamar_integrasi : ${kamarMaster.size}`)
  console.log(`   - Firebase kamar diupdate                : ${countUpdatedFB}`)
  console.log(`   - Firebase kamar baru dibuat             : ${countCreatedFB}`)
  console.log(`   - Firebase pasien ditautkan ke kamarId   : ${countKamarIdLinked}`)
  console.log('=================================================================')
}

main().catch(err => {
  console.error('\n💥 Terjadi kesalahan:', err)
  process.exit(1)
})
