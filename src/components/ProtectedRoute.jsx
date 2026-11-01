import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canAccess } from '../lib/roles'
import Spinner from './ui/Spinner'

export default function ProtectedRoute({ children, allow }) {
  const { session, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  // Belum login
  if (!session) return <Navigate to="/login" replace />

  // Cek role kalau ada pembatasan
  if (allow && !allow.includes(role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

