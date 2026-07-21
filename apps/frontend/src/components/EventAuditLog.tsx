import React from 'react';
import { KitchenEvent } from '@ticketflow/types';
import { X, Layers, Activity, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react';

interface EventAuditLogProps {
  isOpen: boolean;
  onClose: () => void;
  events: KitchenEvent[];
  lastProcessedSequence: number;
}

export const EventAuditLog: React.FC<EventAuditLogProps> = ({
  isOpen,
  onClose,
  events,
  lastProcessedSequence,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-slate-900/95 backdrop-blur-md border-l border-slate-800 shadow-2xl p-4 flex flex-col justify-between animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">Sequence Event Audit</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current State Info */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 mb-4 flex items-center justify-between font-mono text-xs">
          <div>
            <span className="text-slate-500">Highest Seq:</span>
            <span className="text-sky-400 font-bold ml-1.5">#{lastProcessedSequence}</span>
          </div>
          <div>
            <span className="text-slate-500">Total Logged:</span>
            <span className="text-amber-400 font-bold ml-1.5">{events.length} events</span>
          </div>
        </div>

        {/* Real-time Event Stream Feed */}
        <div className="space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
          {events.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No sequence events recorded yet. Create orders or transition state to observe live event stream.
            </div>
          ) : (
            [...events].reverse().map((evt) => (
              <div
                key={evt.eventId || evt.sequenceNumber}
                className="bg-slate-950 p-3 rounded-xl border border-slate-800 hover:border-slate-700 transition-all font-mono text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 font-bold border border-sky-500/30">
                    Seq #{evt.sequenceNumber}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-300">
                  <span className="font-semibold text-amber-400">{evt.type}</span>
                  <span className="text-[11px] text-slate-400">Order: {evt.orderId.slice(-6)}</span>
                </div>

                <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800/80">
                  <p>Status: <span className="text-emerald-400">{evt.payload.newStatus}</span></p>
                  {evt.payload.stationId && <p>Station: <span className="text-purple-400">{evt.payload.stationId}</span></p>}
                  {evt.payload.customerName && <p>Customer: {evt.payload.customerName}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 pt-3 text-[11px] text-slate-500 flex items-center justify-between font-mono">
        <span>Monotonic Sourcing Active</span>
        <span className="text-emerald-400 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Synchronized
        </span>
      </div>
    </div>
  );
};
