import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Plane, BookOpen, Bell, BarChart2, CreditCard, Shield, Home, User, LogOut } from 'lucide-react'

const NAV = [
  { to: '/',           label: 'Dashboard',  icon: Home,      roles: ['agent','supervisor','finance','admin'] },
  { to: '/search',     label: 'Suche',      icon: Plane,     roles: ['agent','supervisor','admin'] },
  { to: '/bookings',   label: 'Buchungen',  icon: BookOpen,  roles: ['agent','supervisor','admin'] },
  { to: '/fare-watch', label: 'Preisalarm', icon: Bell,      roles: ['agent','supervisor','admin'] },
  { to: '/analytics',  label: 'Analytics',  icon: BarChart2, roles: ['agent','supervisor','finance','admin'] },
  { to: '/alerts',     label: 'Alarme',     icon: Bell,      roles: ['agent','supervisor','admin'] },
  { to: '/billing',    label: 'Billing',    icon: CreditCard, roles: ['finance','admin'] },
  { to: '/admin',      label: 'Admin',      icon: Shield,    roles: ['admin'] },
]

export default function Layout() {
  const { email, role, logout } = useAuthStore()
  const nav = useNavigate()

  function handleLogout() {
    logout()
    nav('/login')
  }

  const visible = NAV.filter(n => n.roles.includes(role))

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Nav */}
      <nav className="bg-gradient-to-r from-teal-700 to-teal-500 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 h-14">
          <span className="text-white font-bold text-lg mr-4 flex items-center gap-2">
            <Plane size={20} /> FlyCentral
          </span>
          {visible.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/20 text-white' : 'text-teal-100 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-teal-100 text-sm hidden sm:block">
              {email} · <span className="text-white font-semibold">{role}</span>
            </span>
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `flex items-center gap-1 text-sm transition-colors ${isActive ? 'text-white' : 'text-teal-100 hover:text-white'}`
              }
            >
              <User size={15} />
            </NavLink>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-teal-100 hover:text-white text-sm transition-colors"
            >
              <LogOut size={15} /> Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
