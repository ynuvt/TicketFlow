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
  CheckCircle2,
} from 'lucide-react';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  isSystemOnline: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate, isSystemOnline }) => {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'All Stations', path: '/all-stations', icon: LayoutGrid },
    { name: 'Order Intake', path: '/intake', icon: ClipboardList },
    { name: 'Prep Line', path: '/prep', icon: UtensilsCrossed },
    { name: 'Grill & Cook', path: '/grill', icon: Flame },
    { name: 'Plate & Assembly', path: '/assembly', icon: PackageCheck },
    { name: 'Expedite & Pass', path: '/expedite', icon: ConciergeBell },
    { name: 'Orders', path: '/orders', icon: Receipt },
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

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between shrink-0 min-h-screen select-none">
      <div>
        {/* Brand Header */}
        <div className="p-6 pb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Ticket className="w-5 h-5 font-bold" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Ticket Flow</h1>
            <p className="text-xs font-semibold text-blue-600">KDS v1.0</p>
          </div>
        </div>

        {/* Navigation Items */}
  <nav className="px-3 py-2 space-y-1">
  {navItems.map((item) => {
    const Icon = item.icon;
    const active = isActivePath(item.path);

    return (
      <a
        key={item.path}
        href={item.path}
        onClick={(e) => {
          // If Ctrl (Windows/Linux) or Cmd (Mac) is pressed, let browser open in new tab natively
          if (e.ctrlKey || e.metaKey) {
            return; 
          }
          // Otherwise prevent full page reload and navigate using SPA client router
          e.preventDefault();
          onNavigate(item.path);
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
      <div className="p-4 space-y-4">
        {/* Network Status Card */}
        <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl flex items-center justify-between text-xs">
          <div>
            <p className="font-semibold text-slate-700 text-[11px]">Network Status</p>
            <p className="text-slate-500 text-[11px]">All Systems</p>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/60 font-semibold text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Online</span>
          </div>
        </div>

        {/* Copyright */}
        <div className="text-[11px] text-slate-400 px-1 font-mono">
          <p>© 2025 Ticket Flow</p>
          <p>KDS v1.0</p>
        </div>
      </div>
    </aside>
  );
};
