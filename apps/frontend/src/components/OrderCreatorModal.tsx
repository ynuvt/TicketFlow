import React, { useState, useEffect } from 'react';
import { CreateOrderPayload, OrderItem, StationId, Order } from '@ticketflow/types';
import { X, Plus, Trash2, Sparkles, Receipt } from 'lucide-react';

interface OrderCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateOrder: (payload: Omit<CreateOrderPayload, 'kitchenId'>) => void;
  onUpdateOrder?: (orderId: string, payload: Omit<CreateOrderPayload, 'kitchenId'>) => void;
  initialOrder?: Order | null;
}

const PRESET_ITEMS = [
  { id: 'preset-1', name: 'Paneer Tikka Pizza (Veg)', defaultNotes: 'Tandoori sauce, paneer' },
  { id: 'preset-2', name: 'Chicken Tikka Pizza (Non-Veg)', defaultNotes: 'Double tikka chunks' },
  { id: 'preset-3', name: 'Butter Chicken Zinger Burger', defaultNotes: 'Butter chicken mayo' },
  { id: 'preset-4', name: 'Aloo Tikki Burger (Veg)', defaultNotes: 'Sweet tamarind chutney' },
  { id: 'preset-5', name: 'Masala Corn & Cheese Pizza', defaultNotes: 'Golden corn, local spices' },
  { id: 'preset-6', name: 'Masala Paneer Burger (Veg)', defaultNotes: 'Grilled paneer patty' },
];

export const OrderCreatorModal: React.FC<OrderCreatorModalProps> = ({
  isOpen,
  onClose,
  onCreateOrder,
  onUpdateOrder,
  initialOrder = null,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'VIP'>('NORMAL');
  const [estimatedPrepTime, setEstimatedPrepTime] = useState<number>(10);
  const [targetStation, setTargetStation] = useState<StationId>('intake');
  const [items, setItems] = useState<OrderItem[]>([
    { id: '1', name: 'Paneer Tikka Pizza (Veg)', quantity: 1, notes: 'Extra tandoori sauce' },
  ]);

  useEffect(() => {
    if (isOpen) {
      if (initialOrder) {
        setCustomerName(initialOrder.customerName);
        setPriority(initialOrder.priority);
        setEstimatedPrepTime(initialOrder.estimatedPrepTime);
        setTargetStation(initialOrder.currentStationId);
        setItems(initialOrder.items);
      } else {
        setCustomerName('');
        setPriority('NORMAL');
        setEstimatedPrepTime(10);
        setTargetStation('intake');
        setItems([{ id: '1', name: 'Paneer Tikka Pizza (Veg)', quantity: 1, notes: 'Extra tandoori sauce' }]);
      }
    }
  }, [isOpen, initialOrder]);

  if (!isOpen) return null;

  const handleAddItem = (presetName?: string, defaultNotes?: string) => {
    const newItem: OrderItem = {
      id: Date.now().toString(),
      name: presetName || 'New Kitchen Item',
      quantity: 1,
      notes: defaultNotes || '',
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleUpdateItem = (id: string, fields: Partial<OrderItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...fields } : i)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || items.length === 0) return;

    const payload = {
      customerName: customerName.trim(),
      priority,
      estimatedPrepTime,
      stationId: targetStation,
      items,
    };

    if (initialOrder && onUpdateOrder) {
      onUpdateOrder(initialOrder.id, payload);
    } else {
      onCreateOrder(payload);
    }

    // Reset and close
    setCustomerName('');
    setItems([{ id: '1', name: 'Paneer Tikka Pizza (Veg)', quantity: 1, notes: 'Extra tandoori sauce' }]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-900 rounded-2xl max-w-xl w-full p-6 pt-8 shadow-2xl relative overflow-hidden font-mono text-slate-900 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Jagged Torn Paper Top Mask */}
        <div className="absolute top-0 left-0 right-0 h-3.5 overflow-hidden select-none -translate-y-[1px]">
          <svg className="w-full h-full fill-slate-950/80" viewBox="0 0 100 10" preserveAspectRatio="none">
            <path d="M0,10 L2.5,0 L5,10 L7.5,0 L10,10 L12.5,0 L15,10 L17.5,0 L20,10 L22.5,0 L25,10 L27.5,0 L30,10 L32.5,0 L35,10 L37.5,0 L40,10 L42.5,0 L45,10 L47.5,0 L50,10 L52.5,0 L55,10 L57.5,0 L60,10 L62.5,0 L65,10 L67.5,0 L70,10 L72.5,0 L75,10 L77.5,0 L80,10 L82.5,0 L85,10 L87.5,0 L90,10 L92.5,0 L95,10 L97.5,0 L100,10 L100,10 L0,10 Z" />
          </svg>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-dashed border-slate-400 pb-4 text-center">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-300 flex items-center justify-center shadow-sm">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h2 className="text-base font-black text-slate-900 tracking-wider">
                {initialOrder ? 'Edit Pizza KOT' : 'The Wesee Pizzas'}
              </h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                {initialOrder ? `Editing KOT #${initialOrder.id.slice(-6).toUpperCase()}` : 'New KOT Generation receipt'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Customer */}
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase mb-1">Customer / Table ID</label>
            <input
              type="text"
              required
              placeholder="e.g. Table 4 or Order #5"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-slate-950 focus:bg-white"
            />
          </div>

          {/* Prep Time */}
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase mb-1">Est. Prep Time (Mins)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={estimatedPrepTime}
              onChange={(e) => setEstimatedPrepTime(parseInt(e.target.value, 10) || 10)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-slate-950 focus:bg-white"
            />
          </div>

          {/* Quick Preset Buttons */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-700 uppercase">Quick Add Menu Items</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_ITEMS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleAddItem(preset.name, preset.defaultNotes)}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-50/50 hover:bg-amber-50 text-amber-900 border border-amber-300/80 text-[11px] font-black flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            <label className="block text-xs font-black text-slate-700 uppercase">Order Items ({items.length})</label>
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={item.quantity}
                  onChange={(e) => handleUpdateItem(item.id, { quantity: parseInt(e.target.value, 10) || 1 })}
                  className="w-12 bg-white border border-slate-300 rounded-lg px-1.5 py-1 text-center font-mono font-black text-xs text-blue-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                <input
                  type="text"
                  placeholder="Item name"
                  value={item.name}
                  onChange={(e) => handleUpdateItem(item.id, { name: e.target.value })}
                  className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                <input
                  type="text"
                  placeholder="Notes"
                  value={item.notes || ''}
                  onChange={(e) => handleUpdateItem(item.id, { notes: e.target.value })}
                  className="w-1/3 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-amber-700 focus:outline-none focus:ring-1 focus:ring-slate-900 font-bold"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-dashed border-slate-400">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition-colors font-mono cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!customerName.trim() || items.length === 0}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-black text-xs disabled:opacity-50 transition-all flex items-center gap-1.5 font-mono cursor-pointer active:scale-95 shadow-md"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{initialOrder ? 'Save Changes' : 'Broadcast Ticket'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
