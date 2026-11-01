import { supabase } from '../lib/supabaseClient'

export async function getMenu() {
  const { data, error } = await supabase
    .from('menu')
    .select('*, menu_diet(jenis_diet_id), resep(id, bahan_id, jumlah_per_porsi, bahan:bahan_makanan(nama, satuan))')
    .order('nama')
  if (error) throw error
  return data
}

export async function createMenu(menu, dietIds = [], resepItems = []) {
  const { data, error } = await supabase.from('menu').insert(menu).select().single()
  if (error) throw error

  // Relasi menu-diet
  if (dietIds.length > 0) {
    const rows = dietIds.map(jenis_diet_id => ({ menu_id: data.id, jenis_diet_id }))
    const { error: e2 } = await supabase.from('menu_diet').insert(rows)
    if (e2) throw e2
  }

  // Resep
  if (resepItems.length > 0) {
    const rows = resepItems.map(r => ({ menu_id: data.id, bahan_id: r.bahan_id, jumlah_per_porsi: r.jumlah_per_porsi }))
    const { error: e3 } = await supabase.from('resep').insert(rows)
    if (e3) throw e3
  }

  return data
}

export async function updateMenu(id, menu, dietIds = [], resepItems = []) {
  const { data, error } = await supabase.from('menu').update(menu).eq('id', id).select().single()
  if (error) throw error

  // Hapus relasi lama, masukkan yang baru
  await supabase.from('menu_diet').delete().eq('menu_id', id)
  if (dietIds.length > 0) {
    const rows = dietIds.map(jenis_diet_id => ({ menu_id: id, jenis_diet_id }))
    const { error: e2 } = await supabase.from('menu_diet').insert(rows)
    if (e2) throw e2
  }

  await supabase.from('resep').delete().eq('menu_id', id)
  if (resepItems.length > 0) {
    const rows = resepItems.map(r => ({ menu_id: id, bahan_id: r.bahan_id, jumlah_per_porsi: r.jumlah_per_porsi }))
    const { error: e3 } = await supabase.from('resep').insert(rows)
    if (e3) throw e3
  }

  return data
}

export async function deleteMenu(id) {
  const { error } = await supabase.from('menu').delete().eq('id', id)
  if (error) throw error
}

