import React from 'react';
import { KitchenEvent } from '@ticketflow/types';
import { Bell, Activity, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface AlertsViewProps {
  events: KitchenEvent[];
  lastProcessedSequence: number;
}

export const AlertsView: React.FC<AlertsViewProps> = ({ events, lastProcessedSequence }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            System Alerts & Sequence Log
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Monotonic event log and reconnect gap detection alerts
          </p>
        </div>

        <div className="space-y-3">
          {events.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 font-mono">
              No alerts recorded. System operational.
            </div>
          ) : (
            [...events].reverse().map((evt) => (
              <div
                key={evt.eventId || evt.sequenceNumber}
                className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl flex items-center justify-between font-mono text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded bg-blue-100 text-blue-700 font-bold text-xs">
                    Seq #{evt.sequenceNumber}
                  </span>
                  <div>
                    <p className="font-bold text-slate-900">{evt.type}</p>
                    <p className="text-slate-500 text-[11px]">
                      Order #{evt.orderId.slice(-6)} → {evt.payload.newStatus} ({evt.payload.stationId || 'intake'})
                    </p>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-400">
                  {new Date(evt.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
