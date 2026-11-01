import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'

// Halaman
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Bangsal from './pages/master/Bangsal'
import JenisDiet from './pages/master/JenisDiet'
import Pasien from './pages/master/Pasien'
import Menu from './pages/master/Menu'
import Bahan from './pages/master/Bahan'
import Stok from './pages/Stok'
import MenuHarian from './pages/MenuHarian'
import PesananMakan from './pages/PesananMakan'
import PengajuanDiet from './pages/PengajuanDiet'
import PengajuanPembelian from './pages/PengajuanPembelian'
import Pengembalian from './pages/Pengembalian'
import Laporan from './pages/Laporan'
import Grafik from './pages/Grafik'
import Pengaturan from './pages/Pengaturan'
import Profil from './pages/Profil'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Semua halaman dalam layout + auth check */}
          <Route element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }>
            <Route path="/dashboard" element={<Dashboard />} />

            {/* Master data */}
            <Route path="/bangsal" element={<ProtectedRoute allow={['admin']}><Bangsal /></ProtectedRoute>} />
            <Route path="/diet" element={<ProtectedRoute allow={['admin','ahli_gizi','koki','perawat']}><JenisDiet /></ProtectedRoute>} />
            <Route path="/pasien" element={<ProtectedRoute allow={['admin','ahli_gizi','perawat']}><Pasien /></ProtectedRoute>} />
            <Route path="/menu" element={<ProtectedRoute allow={['admin','ahli_gizi','koki']}><Menu /></ProtectedRoute>} />
            <Route path="/bahan" element={<ProtectedRoute allow={['admin','ahli_gizi','koki','gudang']}><Bahan /></ProtectedRoute>} />

            {/* Operasional */}
            <Route path="/stok" element={<ProtectedRoute allow={['admin','ahli_gizi','koki','gudang']}><Stok /></ProtectedRoute>} />
            <Route path="/menu-harian" element={<ProtectedRoute allow={['admin','ahli_gizi','koki']}><MenuHarian /></ProtectedRoute>} />
            <Route path="/pesanan" element={<ProtectedRoute allow={['admin','ahli_gizi','koki','perawat']}><PesananMakan /></ProtectedRoute>} />
            <Route path="/pengajuan-diet" element={<ProtectedRoute allow={['admin','ahli_gizi','perawat']}><PengajuanDiet /></ProtectedRoute>} />
            <Route path="/pengajuan-pembelian" element={<ProtectedRoute allow={['admin','koki','gudang']}><PengajuanPembelian /></ProtectedRoute>} />
            <Route path="/pengembalian" element={<ProtectedRoute allow={['admin','ahli_gizi','koki','perawat']}><Pengembalian /></ProtectedRoute>} />

            {/* Laporan & grafik */}
            <Route path="/laporan" element={<ProtectedRoute allow={['admin','ahli_gizi','koki','gudang']}><Laporan /></ProtectedRoute>} />
            <Route path="/grafik" element={<ProtectedRoute allow={['admin','ahli_gizi','koki','gudang']}><Grafik /></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/pengaturan" element={<ProtectedRoute allow={['admin']}><Pengaturan /></ProtectedRoute>} />
            <Route path="/profil" element={<Profil />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
