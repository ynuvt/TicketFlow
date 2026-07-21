import React, { useState, useEffect } from 'react';
import { RefreshCw, Bell, Volume2, VolumeX, Activity, ChevronDown } from 'lucide-react';
import { kitchenAudio } from '../utils/audio';

interface HeaderProps {
  title: string;
  subtitle: string;
  isOnline: boolean;
  onRefresh: () => void;
  onOpenAuditLog: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  isOnline,
  onRefresh,
  onOpenAuditLog,
}) => {
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
    <header className="bg-white border-b border-slate-200/80 px-8 py-5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      {/* Page Title & Subtitle */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
        <p className="text-xs text-slate-500 mt-0.5 font-medium">{subtitle}</p>
      </div>

      {/* Top Right Controls & Profile */}
      <div className="flex items-center gap-3">
        {/* System Online Status Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>System Online</span>
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

        {/* Notifications Button */}
        <button
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors relative"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600" />
        </button>

        {/* Admin User Profile Dropdown Badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
            AM
          </div>
          <span className="text-xs font-semibold text-slate-800">Admin Manager</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>
    </header>
  );
};
