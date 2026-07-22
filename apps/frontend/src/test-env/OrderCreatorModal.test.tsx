import React, { useState } from 'react';
import { CreateOrderPayload, OrderItem, StationId } from '@ticketflow/types';
import { X, Plus, Trash2, Sparkles, Receipt } from 'lucide-react';

interface OrderCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateOrder: (payload: Omit<CreateOrderPayload, 'kitchenId'>) => void;
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
}) => {
  const [customerName, setCustomerName] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'VIP'>('NORMAL');
  const [estimatedPrepTime, setEstimatedPrepTime] = useState<number>(10);
  const [targetStation, setTargetStation] = useState<StationId>('intake');
  const [items, setItems] = useState<OrderItem[]>([
    { id: '1', name: 'Paneer Tikka Pizza (Veg)', quantity: 1, notes: 'Extra tandoori sauce' },
  ]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedingCount, setSeedingCount] = useState(0);

  const handleSeed250 = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!customerName.trim() || items.length === 0 || isSeeding) return;
    setIsSeeding(true);

    for (let i = 1; i <= 250; i++) {
      onCreateOrder({
        customerName: `${customerName.trim()} #${i}`,
        priority,
        estimatedPrepTime,
        stationId: targetStation,
        items: items.map((it, idx) => ({
          id: `seed-item-${i}-${idx}-${Date.now()}`,
          name: it.name,
          quantity: it.quantity,
          notes: it.notes
        }))
      });
      setSeedingCount(i);
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    setIsSeeding(false);
    onClose();
  };

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

    onCreateOrder({
      customerName: customerName.trim(),
      priority,
      estimatedPrepTime,
      stationId: targetStation,
      items: items.map((it) => ({
        id: it.id,
        name: it.name,
        quantity: it.quantity,
        notes: it.notes,
      })),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* Torn-Paper Styled Receipt Modal */}
      <div className="relative bg-white text-slate-900 border-2 border-slate-900 max-w-lg w-full rounded-b-2xl shadow-2xl flex flex-col justify-between overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-[12px] before:bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] before:from-slate-900 before:to-slate-900/0 before:z-10">
        
        {/* Jagged paper tear zig-zag top decoration */}
        <div 
          className="h-4 w-full bg-slate-900"
          style={{
            clipPath: 'polygon(0% 0%, 5% 100%, 10% 0%, 15% 100%, 20% 0%, 25% 100%, 30% 0%, 35% 100%, 40% 0%, 45% 100%, 50% 0%, 55% 100%, 60% 0%, 65% 100%, 70% 0%, 75% 100%, 80% 0%, 85% 100%, 90% 0%, 95% 100%, 100% 0%)'
          }}
        />

        {/* Modal Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 font-mono">
          
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-slate-500 text-xs font-black uppercase tracking-widest">
              <Receipt className="w-4 h-4" />
              <span>New Order Creator</span>
            </div>
            <h2 className="text-lg font-black tracking-wider text-slate-900 uppercase">The Wesee Cafe</h2>
            <p className="text-[10px] text-slate-500 italic">Configure details to broadcast a new KOT receipt</p>
            <div className="border-b border-dashed border-slate-400 my-2" />
          </div>

          {/* Customer & Priority Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-black text-slate-700 uppercase">Customer Name</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-black text-slate-700 uppercase">Ticket Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 font-bold"
              >
                <option value="NORMAL">Normal Workload</option>
                <option value="HIGH">High Priority</option>
                <option value="VIP">VIP Ticket (Expedited)</option>
              </select>
            </div>
          </div>

          {/* Prep Time & Target Station Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-black text-slate-700 uppercase">Est. Prep (Mins)</label>
              <input
                type="number"
                min={1}
                required
                value={estimatedPrepTime}
                onChange={(e) => setEstimatedPrepTime(parseInt(e.target.value, 10) || 5)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 font-bold font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-black text-slate-700 uppercase">Initial Station</label>
              <select
                value={targetStation}
                onChange={(e) => setTargetStation(e.target.value as StationId)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 font-bold"
              >
                <option value="intake">Order Intake</option>
                <option value="prep">Prep Line</option>
                <option value="grill">Grill & Cook</option>
                <option value="assembly">Plate & Assembly</option>
                <option value="expedite">Expedite Pass</option>
              </select>
            </div>
          </div>

          <div className="border-t border-dashed border-slate-300 my-2" />

          {/* Indian Preset Items Quick Add */}
          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-700 uppercase flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Quick Add Presets
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_ITEMS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleAddItem(preset.name, preset.defaultNotes)}
                  className="px-2.5 py-1 text-[10px] bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 text-slate-700 font-bold flex items-center gap-1 transition-all cursor-pointer"
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

          <div className="flex items-center justify-between gap-3 pt-4 border-t border-dashed border-slate-400">
            {/* Seed 250 Demo KOTs Button */}
            <button
              type="button"
              disabled={!customerName.trim() || items.length === 0 || isSeeding}
              onClick={handleSeed250}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs disabled:opacity-50 transition-all flex items-center gap-1.5 font-mono cursor-pointer shadow-md active:scale-95 shrink-0"
            >
              {isSeeding ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                  <span>Seeding ({seedingCount}/250)</span>
                </>
              ) : (
                <>
                  <span>🚀 Seed 250 Demo KOTs</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSeeding}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition-colors font-mono cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!customerName.trim() || items.length === 0 || isSeeding}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-black text-xs disabled:opacity-50 transition-all flex items-center gap-1.5 font-mono cursor-pointer active:scale-95 shadow-md"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Broadcast Ticket</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
