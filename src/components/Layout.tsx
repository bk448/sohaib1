import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { signOutSession } from '../lib/data';
import { useApp } from './AppContext';
import { useToast } from './ToastContext';
import { LeadDrawer } from './LeadDrawer';
import { AddLeadModal } from './AddLeadModal';

export function Layout({ children }: { children: React.ReactNode }) {
  const {
    sites,
    newCounts,
    globalSearch,
    setGlobalSearch,
    setIsAddLeadOpen,
    darkMode,
    toggleDarkMode,
    user,
  } = useApp();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const dashboardSites = sites.filter((s) => s.show_on_dashboard);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.pathname.startsWith('/leads')) {
      navigate('/leads');
    }
  };

  const handleLogout = async () => {
    try {
      await signOutSession();
      navigate('/login', { replace: true });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Logout failed',
        description: err instanceof Error ? err.message : 'Unable to sign out.',
      });
    }
  };

  const navLinkBase =
    'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md transition-colors whitespace-nowrap';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-14 px-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <NavLink
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            Lead Desk
          </NavLink>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Primary Overview */}
          <div className="space-y-1">
            <NavLink
              to="/"
              end
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `${navLinkBase} ${
                  isActive
                    ? 'bg-slate-900 dark:bg-blue-600 text-white font-medium'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <span className="flex items-center gap-2.5 truncate">
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span>All sites</span>
              </span>
              <span className="font-mono text-xs tabular-nums opacity-80">
                {newCounts.totalNew}
              </span>
            </NavLink>
          </div>

          {/* Sites with show_on_dashboard = true */}
          <div>
            <p className="px-3 mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              Sites
            </p>
            {dashboardSites.length === 0 ? (
              <p className="px-3 py-1.5 text-xs text-slate-400 dark:text-slate-500">
                No dashboard sites configured
              </p>
            ) : (
              <div className="space-y-0.5">
                {dashboardSites.map((site) => {
                  const count = newCounts.bySiteId[site.id] || 0;
                  return (
                    <NavLink
                      key={site.id}
                      to={`/site/${site.id}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `${navLinkBase} ${
                          isActive
                            ? 'bg-slate-900 dark:bg-blue-600 text-white font-medium'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`
                      }
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10 dark:border-white/20"
                          style={{ backgroundColor: site.color || '#2563EB' }}
                          aria-hidden="true"
                        />
                        <span className="truncate">{site.name}</span>
                      </span>
                      <span className="font-mono text-xs tabular-nums opacity-75 shrink-0">
                        {count}
                      </span>
                    </NavLink>
                  );
                })}
              </div>
            )}
          </div>

          {/* Views & Settings */}
          <div>
            <p className="px-3 mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              Workspace
            </p>
            <div className="space-y-0.5">
              <NavLink
                to="/leads"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `${navLinkBase} ${
                    isActive
                      ? 'bg-slate-900 dark:bg-blue-600 text-white font-medium'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <span>Leads Table</span>
              </NavLink>
              <NavLink
                to="/kanban"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `${navLinkBase} ${
                    isActive
                      ? 'bg-slate-900 dark:bg-blue-600 text-white font-medium'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <span className="flex items-center gap-2.5">
                  <Kanban className="w-4 h-4 shrink-0" />
                  <span>Kanban</span>
                </span>
              </NavLink>
              <NavLink
                to="/sites"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `${navLinkBase} ${
                    isActive
                      ? 'bg-slate-900 dark:bg-blue-600 text-white font-medium'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <span className="flex items-center gap-2.5">
                  <Settings className="w-4 h-4 shrink-0" />
                  <span>Sites</span>
                </span>
              </NavLink>
            </div>
          </div>
        </nav>

        {/* Sidebar Footer: Account & Logout */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
          {user?.email && (
            <div className="px-2.5 text-xs text-slate-500 dark:text-slate-400 truncate">
              {user.email}
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap"
          >
            <LogOut className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0 max-w-xl">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-md"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Global search (name, email, subject, message)..."
                aria-label="Global search"
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </form>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleDarkMode}
              className="p-2 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setIsAddLeadOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-blue-600 rounded-md hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add lead</span>
            </button>
          </div>
        </header>

        {/* Page Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>

      {/* Global Lead Detail Drawer & Add Lead Modal */}
      <LeadDrawer />
      <AddLeadModal />
    </div>
  );
}
