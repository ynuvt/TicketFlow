import React from 'react';
import {
  LayoutDashboard,
  LayoutGrid,
  ClipboardList,
  UtensilsCrossed,
  Flame,
  PackageCheck,
  ConciergeBell,
  Receipt,
  BarChart3,
  Bell,
  Settings,
  Ticket,
  X,
  Users,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  isSystemOnline: boolean;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  isSystemOnline,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const { user, logout, hasStationAccess } = useAuth();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'All Stations', path: '/all-stations', icon: LayoutGrid },
    { name: 'Order Intake', path: '/intake', icon: ClipboardList, stationId: 'intake' },
    { name: 'Prep Line', path: '/prep', icon: UtensilsCrossed, stationId: 'prep' },
    { name: 'Grill & Cook', path: '/grill', icon: Flame, stationId: 'grill' },
    { name: 'Plate & Assembly', path: '/assembly', icon: PackageCheck, stationId: 'assembly' },
    { name: 'Expedite & Pass', path: '/expedite', icon: ConciergeBell, stationId: 'expedite' },
    { name: 'Orders', path: '/orders', icon: Receipt },
    { name: 'Staff Management', path: '/staff', icon: Users, managerOnly: true },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'Alerts', path: '/alerts', icon: Bell },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const isActivePath = (itemPath: string) => {
    if (itemPath === '/') {
      return currentPath === '/' || currentPath === '/dashboard';
    }
    return currentPath === itemPath;
  };

  const filteredNavItems = navItems.filter((item) => {
    if (item.managerOnly && user?.role !== 'MANAGER') return false;
    if (item.stationId && !hasStationAccess(item.stationId)) return false;
    return true;
  });

  const content = (
    <div className="h-full flex flex-col justify-between select-none">
      <div>
        {/* Brand Header */}
        <div className="p-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Chef Logo" className="w-10 h-10 object-contain rounded-xl border border-amber-200/80 bg-amber-50/50 p-0.5 shadow-sm" />
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Ticket Flow</h1>
              <p className="text-xs font-semibold text-amber-600">KDS Master Edition</p>
            </div>
          </div>

          {/* Close Mobile Drawer Button */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="px-3 py-2 space-y-1">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(item.path);

            return (
              <a
                key={item.path}
                href={item.path}
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey) {
                    return;
                  }
                  e.preventDefault();
                  onNavigate(item.path);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  active
                    ? 'bg-blue-50 text-blue-600 font-bold shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-slate-500'}`} />
                <span>{item.name}</span>
              </a>
            );
          })}
        </nav>
      </div>

      {/* Footer Section */}
      <div className="p-4 space-y-3">
        {/* User Session Info & Logout */}
        {user && (
          <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="font-bold text-slate-900 text-xs truncate">{user.fullName}</p>
              <p className="text-[10px] font-mono text-slate-500 truncate">@{user.username} ({user.role})</p>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
              title="Logout User Session"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Copyright */}
        <div className="text-[11px] text-slate-400 px-1 font-mono">
          <p>© 2025 Ticket Flow</p>
          <p>KDS v1.0</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200/80 flex-col shrink-0 min-h-screen">
        {content}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-2xl z-10 overflow-y-auto">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
