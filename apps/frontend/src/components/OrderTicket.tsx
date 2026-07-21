import React, { useState, useEffect } from 'react';
import { Order, OrderStatus, StationId } from '@ticketflow/types';
import { STATIONS } from '../types/kds';
import { Clock, ArrowRight, CheckCircle2, User, ShieldAlert } from 'lucide-react';

interface OrderTicketProps {
  order: Order;
  onTransitionOrder: (orderId: string, currentStatus: OrderStatus, newStatus: OrderStatus, stationId?: StationId) => void;
  activeStationId?: StationId | 'overview' | 'manager';
}

export const OrderTicket: React.FC<OrderTicketProps> = ({ order, onTransitionOrder }) => {
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
    if (isUrgent) return 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse';
    if (isWarning) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  const currentStationConfig = STATIONS[order.currentStationId] || STATIONS.intake;

  // Determine next status and station in 5-step pipeline: Intake -> Prep -> Grill -> Assembly -> Expedite -> Served
  const getNextAction = () => {
    switch (order.currentStationId) {
      case 'intake':
        return { targetStatus: 'PREPARING' as OrderStatus, targetStation: 'prep' as StationId, label: 'Send to Prep' };
      case 'prep':
        return { targetStatus: 'PREPARING' as OrderStatus, targetStation: 'grill' as StationId, label: 'Move to Grill' };
      case 'grill':
        return { targetStatus: 'READY' as OrderStatus, targetStation: 'assembly' as StationId, label: 'Plate & Assemble' };
      case 'assembly':
        return { targetStatus: 'READY' as OrderStatus, targetStation: 'expedite' as StationId, label: 'Send to Expedite' };
      case 'expedite':
        if (order.status === 'SERVED') return null;
        return { targetStatus: 'SERVED' as OrderStatus, targetStation: 'expedite' as StationId, label: 'Serve & Complete' };
      default:
        if (order.status === 'PLACED') {
          return { targetStatus: 'PREPARING' as OrderStatus, targetStation: 'prep' as StationId, label: 'Send to Prep' };
        }
        if (order.status === 'PREPARING') {
          return { targetStatus: 'READY' as OrderStatus, targetStation: 'assembly' as StationId, label: 'Plate & Assemble' };
        }
        if (order.status === 'READY') {
          return { targetStatus: 'READY' as OrderStatus, targetStation: 'expedite' as StationId, label: 'Send to Expedite' };
        }
        return null;
    }
  };

  const action = getNextAction();

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
      {/* Ticket Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold text-slate-400">#{order.id.slice(-6).toUpperCase()}</span>
            {order.priority === 'VIP' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" /> VIP
              </span>
            )}
            {order.priority === 'HIGH' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                RUSH
              </span>
            )}
          </div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-400" />
            {order.customerName}
          </h3>
        </div>

        {/* Live Timer Badge */}
        <div className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 ${getTimerBadgeStyle()}`}>
          <Clock className="w-3.5 h-3.5" />
          <span>{formattedTimer}</span>
        </div>
      </div>

      {/* Ticket Items List */}
      <div className="p-4 flex-1 space-y-2.5">
        <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1">
          <span>ITEMS ({order.items.reduce((acc, item) => acc + item.quantity, 0)})</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-100">
            {currentStationConfig.name}
          </span>
        </div>

        <div className="space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="w-5 h-5 rounded bg-blue-100 text-blue-700 font-mono font-bold text-xs flex items-center justify-center">
                {item.quantity}x
              </span>
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-800">{item.name}</p>
                {item.notes && (
                  <p className="text-[11px] text-amber-700 italic mt-0.5">Note: {item.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ticket Footer & Actions */}
      <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
        <div className="text-[11px] font-mono text-slate-400">
          Status: <span className="text-slate-700 font-bold">{order.status}</span>
        </div>

        {action && (
          <button
            onClick={() => onTransitionOrder(order.id, order.status, action.targetStatus, action.targetStation)}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm shadow-blue-500/20 flex items-center gap-1.5 transition-all"
          >
            <span>{action.label}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}

        {order.status === 'SERVED' && (
          <div className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Served</span>
          </div>
        )}
      </div>
    </div>
  );
};
