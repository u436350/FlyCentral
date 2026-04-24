import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { Plane, BookOpen, Bell, BarChart2, CreditCard, Shield, Home, User, LogOut, Users, Package, Globe, FileText, Euro, Users2, Calendar, Building2, Moon, Sun, Menu, X } from 'lucide-react'
import LanguageSwitcher from './LanguageSwitcher'
import AIChat from './AIChat'
import { useThemeStore } from '../store/themeStore'
import { useState } from 'react'

export default function Layout() {
  const { email, role, logout } = useAuthStore()
  const { t } = useTranslation()
  const nav = useNavigate()
  const { isDark, toggleDark } = useThemeStore()
  const [menuOpen, setMenuOpen] = useState(false)

  const NAV = [
    { to: '/',               label: t('nav.dashboard'),   icon: Home,       roles: ['agent','supervisor','finance','admin'] },
    { to: '/search',         label: t('nav.search'),       icon: Plane,      roles: ['agent','supervisor','admin'] },
    { to: '/bookings',       label: t('nav.bookings'),     icon: BookOpen,   roles: ['agent','supervisor','admin'] },
    { to: '/customers',      label: 'Kunden',              icon: Users,      roles: ['agent','supervisor','admin'] },
    { to: '/packages',       label: 'Pakete',              icon: Package,    roles: ['agent','supervisor','admin'] },
    { to: '/group-bookings', label: 'Gruppen',             icon: Users2,     roles: ['agent','supervisor','admin'] },
    { to: '/calendar',       label: 'Kalender',            icon: Calendar,   roles: ['agent','supervisor','admin'] },
    { to: '/angebot',        label: 'Angebot',             icon: FileText,   roles: ['agent','supervisor','admin'] },
    { to: '/visa',           label: 'Visa',                icon: Globe,      roles: ['agent','supervisor','admin'] },
    { to: '/commissions',    label: 'Provisionen',         icon: Euro,       roles: ['supervisor','finance','admin'] },
    { to: '/fare-watch',     label: t('nav.fareWatch'),    icon: Bell,       roles: ['agent','supervisor','admin'] },
    { to: '/analytics',      label: t('nav.analytics'),    icon: BarChart2,  roles: ['agent','supervisor','finance','admin'] },
    { to: '/hotels',         label: 'Hotels',              icon: Building2,  roles: ['agent','supervisor','admin'] },
    { to: '/push',           label: 'Benachrichtigungen',  icon: Bell,       roles: ['agent','supervisor','admin','finance'] },
    { to: '/billing',        label: t('nav.billing'),      icon: CreditCard, roles: ['finance','admin'] },
    { to: '/admin',          label: t('nav.admin'),        icon: Shield,     roles: ['admin'] },
  ]

  function handleLogout() {
    logout()
    nav('/login')
  }

  const visible = NAV.filter(n => n.roles.includes(role))

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex flex-col overflow-x-hidden">
      {/* Top Nav */}
      <nav className="bg-gradient-to-r from-teal-700 to-teal-500 shadow-lg sticky top-0 z-50">
        <div className="px-4 flex items-center gap-1 h-14">
          <span className="text-white font-bold text-lg flex items-center gap-2 shrink-0 mr-2">
            <Plane size={20} /> FlyCentral
          </span>

          {/* Desktop: scrollable nav links */}
          <div className="hidden md:flex items-center gap-0.5 overflow-x-auto flex-1 scrollbar-hide">
            {visible.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isActive ? 'bg-white/20 text-white' : 'text-teal-100 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon size={13} />
                {label}
              </NavLink>
            ))}
          </div>

          {/* Right side controls */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <LanguageSwitcher />
            <span className="text-teal-100 text-xs hidden xl:block">
              {email} · <span className="text-white font-semibold">{role}</span>
            </span>
            <NavLink to="/profile" className={({ isActive }) =>
              `flex items-center text-sm transition-colors ${isActive ? 'text-white' : 'text-teal-100 hover:text-white'}`
            }>
              <User size={15} />
            </NavLink>
            <button
              onClick={toggleDark}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-teal-100 hover:bg-white/10 hover:text-white transition-colors"
              title={isDark ? 'Hell' : 'Dunkel'}
            >
              {isDark ? <Sun size={16}/> : <Moon size={16}/>}
            </button>
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-1 text-teal-100 hover:text-white text-sm transition-colors"
            >
              <LogOut size={15} /> {t('nav.logout')}
            </button>
            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-teal-100 hover:bg-white/10 hover:text-white transition-colors"
            >
              {menuOpen ? <X size={18}/> : <Menu size={18}/>}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="md:hidden bg-teal-800 px-4 pb-4 flex flex-col gap-1">
            {visible.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-white/20 text-white' : 'text-teal-100 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon size={15} />
                {label}
              </NavLink>
            ))}
            <button
              onClick={() => { handleLogout(); setMenuOpen(false) }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-teal-100 hover:bg-white/10 hover:text-white mt-1 border-t border-white/20 pt-3"
            >
              <LogOut size={15} /> {t('nav.logout')}
            </button>
          </div>
        )}
      </nav>

      {/* Page Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>

      {/* AI Chat Widget */}
      <AIChat />
    </div>
  )
}
