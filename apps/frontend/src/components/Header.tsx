import React, { useState, useEffect } from 'react';
import { RefreshCw, Bell, Volume2, VolumeX, Activity, Menu, LogOut, Shield } from 'lucide-react';
import { kitchenAudio } from '../utils/audio';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  title: string;
  subtitle: string;
  isOnline: boolean;
  onRefresh: () => void;
  onOpenAuditLog: () => void;
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  isOnline,
  onRefresh,
  onOpenAuditLog,
  onOpenMobileMenu,
}) => {
  const { user, logout } = useAuth();
  const [isMuted, setIsMuted] = useState<boolean>(kitchenAudio.getMuted());
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-white border-b border-slate-200/80 px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      {/* Mobile Hamburger & Page Title */}
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            title="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 font-medium hidden sm:block">{subtitle}</p>
        </div>
      </div>

      {/* Top Right Controls & Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* System Online Status Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Online</span>
        </div>

        {/* Audit Log Trigger */}
        <button
          onClick={onOpenAuditLog}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors"
          title="Sequence Audit Log"
        >
          <Activity className="w-4 h-4 text-purple-600" />
        </button>

        {/* Audio Mute/Unmute */}
        <button
          onClick={() => {
            const muted = kitchenAudio.toggleMute();
            setIsMuted(muted);
          }}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors"
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-blue-600" />}
        </button>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors"
          title="Refresh Events"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* User Profile & Logout */}
        {user && (
          <div className="flex items-center gap-2.5 pl-2.5 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 font-extrabold text-xs flex items-center justify-center shadow-sm">
              {user.fullName.substring(0, 2).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold text-slate-900 leading-tight">{user.fullName}</p>
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{user.role}</span>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
