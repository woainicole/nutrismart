import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { MENU_ITEMS, ROLE_LABEL } from '../../lib/roles'
import * as Icons from 'lucide-react'

export default function Sidebar({ open, onClose }) {
  const { profile, role } = useAuth()
  const filtered = MENU_ITEMS.filter(m => m.allow.includes(role))

  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 flex flex-col transition-transform lg:translate-x-0 lg:static lg:z-auto ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <h1 className="text-xl font-bold text-emerald-700">🍽️ NutriSmart</h1>
          <p className="text-xs text-gray-400 mt-0.5">{profile?.nama} — {ROLE_LABEL[role]}</p>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto py-2">
          {filtered.map(item => {
            const Icon = Icons[item.icon] || Icons.Circle
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 font-medium border-r-2 border-emerald-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
      </aside>
    </>
  )
}

