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
    if (order.status === 'SERVED') return null;

    const station = order.currentStationId || 'intake';

    if (station === 'intake' || order.status === 'PLACED') {
      return {
        targetStatus: 'PREPARING' as OrderStatus,
        targetStation: 'prep' as StationId,
        label: `Send KOT ${kotShortId} → Prep`,
      };
    }

    if (station === 'prep') {
      return {
        targetStatus: 'PREPARING' as OrderStatus,
        targetStation: 'grill' as StationId,
        label: `Move KOT ${kotShortId} → Grill`,
      };
    }

    if (station === 'grill') {
      return {
        targetStatus: 'READY' as OrderStatus,
        targetStation: 'assembly' as StationId,
        label: `Plate KOT ${kotShortId} → Assembly`,
      };
    }

    if (station === 'assembly') {
      return {
        targetStatus: 'READY' as OrderStatus,
        targetStation: 'expedite' as StationId,
        label: `Send KOT ${kotShortId} → Expedite`,
      };
    }

    if (station === 'expedite') {
      return {
        targetStatus: 'SERVED' as OrderStatus,
        targetStation: 'expedite' as StationId,
        label: `Serve KOT ${kotShortId}`,
      };
    }

    return null;
  };

  const action = getNextAction();

  return (
    <div className="bg-white rounded-xl border border-slate-300 shadow-md hover:shadow-xl transition-all flex flex-col justify-between overflow-hidden relative font-mono text-slate-900 select-none p-4 space-y-3">
      {/* KOT Receipt Top Header */}
      <div className="text-center space-y-0.5">
        <p className="text-xs font-black tracking-widest text-slate-600 uppercase">KOT Reciept</p>
        <div className="border-t border-dashed border-slate-400 my-1" />
        <h2 className="text-sm font-black tracking-wider text-slate-900 uppercase">Mc Wesee Pizzas</h2>
        <p className="text-[10px] text-slate-500 leading-tight">
          Vijay Nagar, Near by C21 Mall, Indore, Madhya Pradesh, India.
          <br />
          Mobile No.: 9876543210
        </p>
        <div className="border-t border-dashed border-slate-400 my-1" />
      </div>

      {/* Bill No & Date Metadata */}
      <div className="flex items-center justify-between text-xs font-bold border-b border-dashed border-slate-400 pb-2">
        <div className="flex items-center gap-1">
          <span className="text-slate-600">Bill No:</span>
          <span className="font-black text-xs text-slate-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded">
            {kotShortId}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {order.priority === 'VIP' && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-400 text-slate-950 uppercase shadow-xs">
              VIP
            </span>
          )}
          {order.priority === 'HIGH' && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white uppercase shadow-xs">
              RUSH
            </span>
          )}
          <div className={`px-2 py-0.5 rounded text-xs font-black flex items-center gap-1 border ${getTimerBadgeStyle()}`}>
            <Clock className="w-3 h-3" />
            <span>{formattedTimer}</span>
          </div>
        </div>
      </div>

      {/* Customer Name & Staff Assignment */}
      <div className="flex items-center justify-between text-xs font-bold text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
        <span className="truncate">Customer: <strong className="text-slate-900">{order.customerName}</strong></span>
        {assignedStaffName ? (
          <span className="text-[10px] font-black bg-blue-100 text-blue-900 border border-blue-200 px-1.5 py-0.5 rounded font-mono shrink-0">
            👤 {assignedStaffName}
          </span>
        ) : order.assignedUserId ? (
          <span className="text-[10px] font-black bg-blue-100 text-blue-900 border border-blue-200 px-1.5 py-0.5 rounded font-mono shrink-0">
            👤 Cook Assigned
          </span>
        ) : order.currentStationId !== 'intake' && order.status !== 'SERVED' ? (
          <span className="text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded font-mono shrink-0">
            ⚠️ Unassigned
          </span>
        ) : null}
      </div>

      {/* Highlighted Current KDS Station Status (Intake Receptionist only) */}
      {activeStationId === 'intake' && (
        <div className="bg-slate-900 text-amber-300 font-mono font-black text-center text-[10px] py-1 px-3 rounded-lg uppercase tracking-wider shadow-xs">
          Current Station: {currentStationConfig.name}
        </div>
      )}

      {/* Items Table Header & List */}
      <div className="space-y-2 flex-1">
        <div className="grid grid-cols-12 text-[11px] font-black text-slate-900 border-b border-dashed border-slate-400 pb-1 uppercase">
          <span className="col-span-2">S. NO.</span>
          <span className="col-span-8">ITEM NAME</span>
          <span className="col-span-2 text-right">QTY.</span>
        </div>

        <div className="space-y-1.5 text-xs font-bold text-slate-800">
          {order.items.map((item, idx) => (
            <div key={item.id} className="space-y-0.5">
              <div className="grid grid-cols-12 items-center">
                <span className="col-span-2 text-slate-500 font-mono">{idx + 1}</span>
                <span className="col-span-8 font-black text-slate-900">{item.name}</span>
                <span className="col-span-2 text-right font-black text-blue-700">{item.quantity}</span>
              </div>
              {item.notes && (
                <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded italic ml-6">
                  Note: {item.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Thank You & Action Footer */}
      <div className="space-y-2 pt-1 border-t border-dashed border-slate-400 text-center">
        <p className="text-xs font-black text-slate-700 tracking-wider">Thank You!!!</p>
        <div className="border-t border-dashed border-slate-400 pt-1" />

        {action && activeStationId !== 'intake' && (
          <button
            onClick={() => onTransitionOrder(order.id, order.status, action.targetStatus, action.targetStation)}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-black text-xs shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all font-mono active:scale-95 cursor-pointer"
          >
            <span>{action.label}</span>
            <ArrowRight className="w-4 h-4 text-amber-400" />
          </button>
        )}

        {order.status === 'SERVED' && (
          <div className="w-full py-2 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black flex items-center justify-center gap-1.5 font-mono">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>KOT {kotShortId} Served</span>
          </div>
        )}
      </div>
    </div>
  );
};
