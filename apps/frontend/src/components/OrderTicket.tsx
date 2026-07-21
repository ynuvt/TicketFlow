import React, { useState, useEffect } from 'react';
import { Order, OrderStatus, StationId } from '@ticketflow/types';
import { STATIONS } from '../types/kds';
import { Clock, ArrowRight, CheckCircle2, AlertTriangle, User, ShieldAlert } from 'lucide-react';

interface OrderTicketProps {
  order: Order;
  onTransitionOrder: (orderId: string, currentStatus: OrderStatus, newStatus: OrderStatus, stationId?: StationId) => void;
  activeStationId?: StationId | 'overview' | 'manager';
}

export const OrderTicket: React.FC<OrderTicketProps> = ({ order, onTransitionOrder, activeStationId }) => {
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

  // Urgency status based on elapsed time vs estimated prep time
  const isUrgent = minutes >= order.estimatedPrepTime;
  const isWarning = minutes >= Math.floor(order.estimatedPrepTime * 0.75);

  const getTimerBadgeStyle = () => {
    if (isUrgent) return 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse';
    if (isWarning) return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
  };

  const currentStationConfig = STATIONS[order.currentStationId] || STATIONS.intake;

  // Determine next status and target station
  const getNextAction = () => {
    switch (order.status) {
      case 'PLACED':
        return { targetStatus: 'PREPARING' as OrderStatus, targetStation: 'prep' as StationId, label: 'Start Prep' };
      case 'PREPARING':
        return { targetStatus: 'READY' as OrderStatus, targetStation: 'assembly' as StationId, label: 'Finish Prep / Plating' };
      case 'READY':
        return { targetStatus: 'SERVED' as OrderStatus, targetStation: 'expedite' as StationId, label: 'Serve & Complete' };
      default:
        return null;
    }
  };

  const action = getNextAction();

  return (
    <div className={`bg-slate-900 rounded-xl border ${currentStationConfig.borderColor} shadow-lg hover:shadow-2xl transition-all flex flex-col justify-between overflow-hidden group`}>
      {/* Ticket Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold text-slate-400">#{order.id.slice(-6).toUpperCase()}</span>
            {order.priority === 'VIP' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" /> VIP
              </span>
            )}
            {order.priority === 'HIGH' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                RUSH
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-white flex items-center gap-1.5">
            <User className="w-4 h-4 text-slate-400" />
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
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${currentStationConfig.badgeColor}`}>
            {currentStationConfig.name}
          </span>
        </div>

        <div className="space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-start gap-2.5 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              <span className="w-5 h-5 rounded bg-amber-500/20 text-amber-400 font-mono font-bold text-xs flex items-center justify-center border border-amber-500/30">
                {item.quantity}x
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-200">{item.name}</p>
                {item.notes && (
                  <p className="text-xs text-amber-400/90 italic mt-0.5">Note: {item.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ticket Footer & Actions */}
      <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-2">
        <div className="text-[11px] font-mono text-slate-500">
          Status: <span className="text-slate-300 font-semibold">{order.status}</span>
        </div>

        {action && (
          <button
            onClick={() => onTransitionOrder(order.id, order.status, action.targetStatus, action.targetStation)}
            className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>{action.label}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {order.status === 'SERVED' && (
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>Served & Completed</span>
          </div>
        )}
      </div>
    </div>
  );
};
