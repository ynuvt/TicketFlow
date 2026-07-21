import { StationId, StationRoute, OrderStatus } from '@ticketflow/types';

export interface StationConfig {
  id: StationId;
  name: string;
  route: StationRoute;
  description: string;
  badgeColor: string;
  borderColor: string;
  allowedStatuses: OrderStatus[];
  nextStation?: StationId;
  nextStatus?: OrderStatus;
  actionLabel?: string;
}

export const STATIONS: Record<StationId, StationConfig> = {
  intake: {
    id: 'intake',
    name: 'Order Intake',
    route: 'intake',
    description: 'New orders placed from POS & Manager Dashboard',
    badgeColor: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    borderColor: 'border-sky-500/40',
    allowedStatuses: ['PLACED'],
    nextStation: 'prep',
    nextStatus: 'PREPARING',
    actionLabel: 'Send to Prep Line',
  },
  prep: {
    id: 'prep',
    name: 'Prep Line',
    route: 'prep',
    description: 'Food preparation, vegetable chopping, and sauce mixing',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    borderColor: 'border-amber-500/40',
    allowedStatuses: ['PREPARING'],
    nextStation: 'grill',
    nextStatus: 'PREPARING',
    actionLabel: 'Move to Grill',
  },
  grill: {
    id: 'grill',
    name: 'Grill & Cooking',
    route: 'grill',
    description: 'Hot cooking line, searing, frying, and oven roasting',
    badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    borderColor: 'border-rose-500/40',
    allowedStatuses: ['PREPARING'],
    nextStation: 'assembly',
    nextStatus: 'READY',
    actionLabel: 'Finish Cooking',
  },
  assembly: {
    id: 'assembly',
    name: 'Plate & Assembly',
    route: 'assembly',
    description: 'Plating, garnishing, packaging, and tray loading',
    badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    borderColor: 'border-purple-500/40',
    allowedStatuses: ['READY'],
    nextStation: 'expedite',
    nextStatus: 'READY',
    actionLabel: 'Send to Expedite',
  },
  expedite: {
    id: 'expedite',
    name: 'Expedite & Pass',
    route: 'expedite',
    description: 'Final order inspection and customer server pickup',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    borderColor: 'border-emerald-500/40',
    allowedStatuses: ['READY'],
    nextStatus: 'SERVED',
    actionLabel: 'Serve Order',
  },
};
