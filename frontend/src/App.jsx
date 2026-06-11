import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import DLQView from './pages/DLQView'
import CreateJob from './pages/CreateJob'
import Jobs from './pages/Jobs'

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/jobs', label: 'Jobs' },
  { to: '/jobs/new', label: 'Create Job' },
  { to: '/dlq', label: 'DLQ' },
]

function NavItem({ item }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        [
          'flex items-center rounded-md px-3 py-2 text-sm font-medium transition',
          isActive
            ? 'bg-zinc-900 text-white shadow-sm'
            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950',
        ].join(' ')
      }
    >
      {item.label}
    </NavLink>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-zinc-50 text-zinc-950">
        <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-200 bg-white lg:block">
          <div className="flex h-full flex-col">
            <div className="border-b border-zinc-200 px-6 py-5">
              <Link to="/" className="block">
                <div className="text-base font-semibold tracking-normal">
                  Dilamme Queue
                </div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Job operations
                </div>
              </Link>
            </div>
            <nav className="flex-1 space-y-1 px-3 py-4">
              {navItems.map((item) => (
                <NavItem key={item.to} item={item} />
              ))}
            </nav>
          </div>
        </aside>

        <div className="lg:pl-64">
          <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
            <div className="mb-3 flex items-center justify-between">
              <Link to="/" className="font-semibold">
                Dilamme Queue
              </Link>
              <Link
                to="/jobs/new"
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
              >
                New
              </Link>
            </div>
            <nav className="grid grid-cols-4 gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      'rounded-md px-2 py-2 text-center text-xs font-medium',
                      isActive
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-100 text-zinc-600',
                    ].join(' ')
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </header>

          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/jobs/new" element={<CreateJob />} />
              <Route path="/dlq" element={<DLQView />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App
