import React, { useState, useEffect } from 'react';
import { Order, OrderStatus, StationId } from '@ticketflow/types';
import { STATIONS } from '../types/kds';
import { Clock, ArrowRight, CheckCircle2, User, ShieldAlert, Receipt } from 'lucide-react';

interface OrderTicketProps {
  order: Order;
  onTransitionOrder: (orderId: string, currentStatus: OrderStatus, newStatus: OrderStatus, stationId?: StationId) => void;
  activeStationId?: StationId | 'overview' | 'manager';
  assignedStaffName?: string;
}

export const OrderTicket: React.FC<OrderTicketProps> = ({ order, onTransitionOrder, activeStationId, assignedStaffName }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(
    Math.floor((Date.now() - order.createdAt) / 1000)
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - order.createdAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [order.createdAt]);

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const formattedTimer = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const isUrgent = minutes >= order.estimatedPrepTime;
  const isWarning = minutes >= Math.floor(order.estimatedPrepTime * 0.75);

  const getTimerBadgeStyle = () => {
    if (isUrgent) return 'bg-rose-500 text-white font-bold animate-pulse border-rose-600';
    if (isWarning) return 'bg-amber-400 text-slate-900 font-bold border-amber-500';
    return 'bg-emerald-500 text-white font-bold border-emerald-600';
  };

  const currentStationConfig = STATIONS[order.currentStationId as StationId] || STATIONS.prep;
  const kotShortId = `#${order.id.slice(-6).toUpperCase()}`;

  // Determine next status and station in 5-step pipeline: Intake -> Prep -> Grill -> Assembly -> Expedite -> Served
  const getNextAction = () => {
    switch (activeStationId) {
      case 'intake':
        if (order.status === 'PLACED') {
          return { targetStatus: 'PREPARING' as OrderStatus, targetStation: 'prep' as StationId, label: `Send KOT ${kotShortId} → Prep` };
        }
        return null;

      case 'prep':
        if (order.status === 'PREPARING') {
          return { targetStatus: 'PREPARING' as OrderStatus, targetStation: 'grill' as StationId, label: `Move KOT ${kotShortId} → Grill` };
        }
        return null;

      case 'grill':
        if (order.status === 'PREPARING') {
          return { targetStatus: 'READY' as OrderStatus, targetStation: 'assembly' as StationId, label: `Plate KOT ${kotShortId} → Assembly` };
        }
        return null;

      case 'assembly':
        if (order.status === 'READY') {
          return { targetStatus: 'READY' as OrderStatus, targetStation: 'expedite' as StationId, label: `Send KOT ${kotShortId} → Expedite` };
        }
        return null;

      case 'expedite':
        if (order.status === 'SERVED') return null;
        return { targetStatus: 'SERVED' as OrderStatus, targetStation: 'expedite' as StationId, label: `Serve KOT ${kotShortId}` };
      default:
        if (order.status === 'PLACED') {
          return { targetStatus: 'PREPARING' as OrderStatus, targetStation: 'prep' as StationId, label: `Send KOT ${kotShortId} → Prep` };
        }
        if (order.status === 'PREPARING') {
          return { targetStatus: 'READY' as OrderStatus, targetStation: 'assembly' as StationId, label: `Plate KOT ${kotShortId} → Assembly` };
        }
        if (order.status === 'READY') {
          return { targetStatus: 'READY' as OrderStatus, targetStation: 'expedite' as StationId, label: `Send KOT ${kotShortId} → Expedite` };
        }
        return null;
    }
  };

  const action = getNextAction();

  return (
    <div className="bg-white rounded-2xl border-2 border-slate-900 shadow-md hover:shadow-xl transition-all flex flex-col justify-between overflow-hidden relative font-sans">
      {/* Physical Ticket Header Strip */}
      <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between text-white border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-amber-400" />
          <span className="font-mono text-sm font-black tracking-wider text-amber-300 uppercase">
            KOT {kotShortId}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {order.priority === 'VIP' && (
            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-400 text-slate-950 uppercase flex items-center gap-1 shadow-sm">
              <ShieldAlert className="w-3 h-3" /> VIP
            </span>
          )}
          {order.priority === 'HIGH' && (
            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white uppercase shadow-sm">
              RUSH
            </span>
          )}
          <div className={`px-2 py-0.5 rounded text-xs font-mono font-black flex items-center gap-1 border ${getTimerBadgeStyle()}`}>
            <Clock className="w-3.5 h-3.5" />
            <span>{formattedTimer}</span>
          </div>
        </div>
      </div>

      {/* Ticket Meta Header */}
      <div className="p-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2">
        <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5 truncate">
          <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="truncate">{order.customerName}</span>
        </h3>

        {assignedStaffName ? (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1 font-mono shrink-0 shadow-xs">
            👤 {assignedStaffName}
          </span>
        ) : order.assignedUserId ? (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1 font-mono shrink-0 shadow-xs">
            👤 Cook Assigned
          </span>
        ) : order.currentStationId !== 'intake' && order.status !== 'SERVED' ? (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1 font-mono shrink-0 shadow-xs">
            ⚠️ Unassigned
          </span>
        ) : null}
      </div>

      {/* Physical Ticket Items List */}
      <div className="p-4 flex-1 space-y-2.5 bg-white">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1 border-b border-dashed border-slate-200 pb-1 font-mono">
          <span>KITCHEN ITEMS ({order.items.reduce((acc, item) => acc + item.quantity, 0)})</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">
            {currentStationConfig.name}
          </span>
        </div>

        <div className="space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <span className="w-6 h-6 rounded-lg bg-slate-900 text-amber-300 font-mono font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                {item.quantity}x
              </span>
              <div className="flex-1">
                <p className="text-xs font-black text-slate-900">{item.name}</p>
                {item.notes && (
                  <p className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md italic mt-1 inline-block">
                    Note: {item.notes}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Physical Ticket Footer & KOT Action */}
      <div className="p-3 bg-slate-100/90 border-t-2 border-slate-900 flex items-center justify-between gap-2">
        <div className="text-[11px] font-mono text-slate-500">
          Status: <span className="text-slate-900 font-black">{order.status}</span>
        </div>

        {action && (
          <button
            onClick={() => onTransitionOrder(order.id, order.status, action.targetStatus, action.targetStation)}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-black text-xs shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all font-mono active:scale-95"
          >
            <span>{action.label}</span>
            <ArrowRight className="w-4 h-4 text-amber-400" />
          </button>
        )}

        {order.status === 'SERVED' && (
          <div className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black flex items-center gap-1.5 font-mono shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>KOT {kotShortId} Served</span>
          </div>
        )}
      </div>
    </div>
  );
};
