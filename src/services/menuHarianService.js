import { supabase } from '../lib/supabaseClient'

export async function getMenuHarian(tanggal) {
  const { data, error } = await supabase
    .from('menu_harian')
    .select('*, menu:menu(nama), diet:jenis_diet(nama)')
    .eq('tanggal', tanggal)
    .order('waktu_makan')
  if (error) throw error
  return data
}

export async function upsertMenuHarian(items) {
  // items: [{tanggal, waktu_makan, jenis_diet_id, menu_id}]
  const { data, error } = await supabase
    .from('menu_harian')
    .upsert(items, { onConflict: 'tanggal,waktu_makan,jenis_diet_id' })
    .select()
  if (error) throw error
  return data
}

