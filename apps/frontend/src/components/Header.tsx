import React from 'react';
import { Wifi, WifiOff, RefreshCw, Activity, Layers, PlusCircle, ShieldCheck } from 'lucide-react';
import { StationRoute } from '@ticketflow/types';

interface HeaderProps {
  connectionStatus: 'CONNECTING' | 'ONLINE' | 'SYNCING' | 'DISCONNECTED';
  lastProcessedSequence: number;
  activeOrdersCount: number;
  reconnectedCount: number;
  activeTab: StationRoute;
  onOpenCreateModal: () => void;
  onToggleGlobalNetwork: (online: boolean) => void;
  onOpenAuditLog: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  connectionStatus,
  lastProcessedSequence,
  activeOrdersCount,
  reconnectedCount,
  onOpenCreateModal,
  onToggleGlobalNetwork,
  onOpenAuditLog,
}) => {
  const isOnline = connectionStatus === 'ONLINE';
  const isSyncing = connectionStatus === 'SYNCING';

  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Brand & System Status */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Activity className="w-6 h-6 text-slate-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Ticket<span className="text-amber-400">Flow</span>
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                KDS v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400">Real-Time Event-Sourced Kitchen Display System</p>
          </div>
        </div>

        {/* Real-time System Metrics */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs font-mono">
          {/* Connection Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold ${
              isOnline
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : isSyncing
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}
          >
            {isOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <Wifi className="w-3.5 h-3.5" />
                <span>ONLINE</span>
              </>
            ) : isSyncing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>SYNCING...</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>DISCONNECTED</span>
              </>
            )}
          </div>

          {/* Monotonic Sequence Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 font-medium">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-400">Seq:</span>
            <span className="text-sky-400 font-bold">#{lastProcessedSequence}</span>
          </div>

          {/* Active Ticket Counter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 font-medium">
            <span className="text-slate-400">Active:</span>
            <span className="text-amber-400 font-bold">{activeOrdersCount}</span>
          </div>

          {/* Reconnect Sync Count */}
          {reconnectedCount > 0 && (
            <div className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Replays: {reconnectedCount}</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Event Audit Log Drawer Trigger */}
          <button
            onClick={onOpenAuditLog}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="View Real-Time Sequence Audit Log"
          >
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>Audit Log</span>
          </button>

          {/* Global Network Simulation Switch */}
          <button
            onClick={() => onToggleGlobalNetwork(!isOnline)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isOnline
                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            }`}
            title="Simulate Global WebSocket Network Disconnect/Reconnect"
          >
            {isOnline ? (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Simulate Drop</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Simulate Reconnect</span>
              </>
            )}
          </button>

          {/* Create New Order Button */}
          <button
            onClick={onOpenCreateModal}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md shadow-orange-500/20 flex items-center gap-1.5 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Ticket</span>
          </button>
        </div>
      </div>
    </header>
  );
};
