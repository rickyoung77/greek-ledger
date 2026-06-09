import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BrandMark from './BrandMark'

const NAV_ITEMS = [
  {
    to: '/',
    label: 'Dashboard',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    to: '/budget-accounts',
    label: 'Budget Accounts',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    to: '/expenses',
    label: 'Expenses',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
  },
  {
    to: '/members',
    label: 'Members',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    to: '/dues',
    label: 'Dues',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    to: '/notifications',
    label: 'Notifications',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

const PAGE_TITLES = {
  '/':                 'Dashboard',
  '/budget-accounts':  'Budget Accounts',
  '/expenses':         'Expenses',
  '/members':          'Members',
  '/dues':             'Dues Management',
  '/notifications':    'Notifications',
  '/settings':         'Settings',
}

function avatarInitials(name) {
  if (!name) return '··'
  return name.trim().split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

export default function Layout({ children }) {
  const location = useLocation()
  const { fullName, chapterName, userRole, semester, signOut } = useAuth()

  const pageTitle = PAGE_TITLES[location.pathname] || 'Greek Ledger'
  const initials  = avatarInitials(fullName)
  const subtitle  = [semester, userRole].filter(Boolean).join(' · ')

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#f3efe6' }}>
      {/* Sidebar — navy showpiece */}
      <aside className="gl-navy-panel flex flex-col flex-shrink-0 relative" style={{ width: 264 }}>
        <div className="gl-pinstripe absolute inset-0 pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 px-6 py-6" style={{ borderBottom: '1px solid rgba(196,163,104,0.14)' }}>
          <BrandMark variant="light" size="sm" />
        </div>

        {/* Chapter tag */}
        <div className="relative z-10 px-6 py-4" style={{ borderBottom: '1px solid rgba(196,163,104,0.10)' }}>
          <p className="gl-eyebrow" style={{ color: 'rgba(196,163,104,0.7)' }}>Chapter</p>
          <p className="gl-serif truncate mt-1" style={{ color: '#f3efe6', fontSize: '1.05rem', fontWeight: 600 }}>
            {chapterName || 'Your Chapter'}
          </p>
        </div>

        {/* Nav */}
        <nav className="relative z-10 flex-1 px-3.5 py-5 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13.5px] transition-all duration-150"
              style={({ isActive }) =>
                isActive
                  ? { backgroundColor: 'rgba(196,163,104,0.14)', color: '#f3efe6', fontWeight: 600, boxShadow: 'inset 2px 0 0 #b08d4f' }
                  : { color: 'rgba(243,239,230,0.6)', fontWeight: 500 }
              }
            >
              {icon}
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer — user + sign out */}
        <div className="relative z-10 px-3.5 pb-4 pt-3 space-y-1" style={{ borderTop: '1px solid rgba(196,163,104,0.14)' }}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold flex-shrink-0 gl-serif"
              style={{ backgroundColor: '#b08d4f', color: '#fff' }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium truncate" style={{ color: '#f3efe6' }}>{fullName || 'User'}</p>
              <p className="text-[11.5px] truncate" style={{ color: 'rgba(243,239,230,0.45)' }}>{userRole || 'Member'}</p>
            </div>
          </div>

          <button
            onClick={signOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 text-left"
            style={{ color: 'rgba(243,239,230,0.5)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(243,239,230,0.85)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(243,239,230,0.5)' }}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Right column */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top header */}
        <header
          className="flex items-center justify-between flex-shrink-0 px-9 py-5"
          style={{ backgroundColor: '#faf8f3', borderBottom: '1px solid #e9e2d3' }}
        >
          <h1 className="gl-serif" style={{ fontSize: '1.85rem', fontWeight: 600, color: '#1b2640' }}>{pageTitle}</h1>
          <div className="flex items-center gap-5">
            <button className="relative p-2 rounded-lg transition" style={{ color: '#8a8170' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3efe6'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ backgroundColor: '#b08d4f' }} />
            </button>
            <div className="flex items-center gap-3 pl-5" style={{ borderLeft: '1px solid #e9e2d3' }}>
              <div className="text-right">
                <p className="text-[13.5px] font-semibold" style={{ color: '#1b2640' }}>{chapterName || 'Your Chapter'}</p>
                <p className="text-[11.5px]" style={{ color: '#8a8170' }}>{subtitle || 'Member'}</p>
              </div>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold flex-shrink-0 gl-serif"
                style={{ backgroundColor: '#1b2640', color: '#c4a368' }}
              >
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-9" style={{ backgroundColor: '#f3efe6' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
