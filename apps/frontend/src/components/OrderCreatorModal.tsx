import React, { useState } from 'react';
import { CreateOrderPayload, OrderItem, StationId } from '@ticketflow/types';
import { X, Plus, Trash2, ShieldAlert, Sparkles, ChefHat } from 'lucide-react';

interface OrderCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateOrder: (payload: Omit<CreateOrderPayload, 'kitchenId'>) => void;
}

const PRESET_ITEMS = [
  { id: 'preset-1', name: 'Smash Cheeseburger', defaultNotes: 'Double patty, bacon jam' },
  { id: 'preset-2', name: 'Wood-Fired Margherita Pizza', defaultNotes: 'Fresh basil & mozzarella' },
  { id: 'preset-3', name: 'Ribeye Steak (12oz)', defaultNotes: 'Medium rare, herb butter' },
  { id: 'preset-4', name: 'Caesar Salad Bowl', defaultNotes: 'Grilled chicken, croutons' },
  { id: 'preset-5', name: 'Crispy Truffle Fries', defaultNotes: 'Parmesan & garlic dip' },
  { id: 'preset-6', name: 'Craft IPA / Soda Pint', defaultNotes: 'Ice cold' },
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
    { id: '1', name: 'Smash Cheeseburger', quantity: 2, notes: 'Medium rare, extra pickles' },
  ]);

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
      items,
    });

    // Reset and close
    setCustomerName('');
    setItems([{ id: '1', name: 'Smash Cheeseburger', quantity: 2, notes: 'Medium rare, extra pickles' }]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Create Kitchen Order Ticket</h2>
              <p className="text-xs text-slate-400">Broadcasts instant sequence event to KDS boards</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Customer / Table Identifier</label>
              <input
                type="text"
                required
                placeholder="e.g. Table 12 or Order #204"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Priority Level</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['NORMAL', 'HIGH', 'VIP'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`py-2 rounded-lg text-xs font-bold transition-all border ${
                      priority === p
                        ? p === 'VIP'
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold'
                          : p === 'HIGH'
                          ? 'bg-rose-500 text-white border-rose-400 font-extrabold'
                          : 'bg-sky-500 text-white border-sky-400 font-extrabold'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Prep Time & Initial Station */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Est. Prep Time (minutes)</label>
              <input
                type="number"
                min={1}
                max={60}
                value={estimatedPrepTime}
                onChange={(e) => setEstimatedPrepTime(parseInt(e.target.value, 10) || 10)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Initial Station</label>
              <select
                value={targetStation}
                onChange={(e) => setTargetStation(e.target.value as StationId)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              >
                <option value="intake">Order Intake (PLACED)</option>
                <option value="prep">Prep Line (PREPARING)</option>
                <option value="grill">Grill & Cooking (PREPARING)</option>
              </select>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Quick Add Menu Items</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_ITEMS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleAddItem(preset.name, preset.defaultNotes)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3 text-amber-400" />
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            <label className="block text-xs font-semibold text-slate-300">Order Items ({items.length})</label>
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={item.quantity}
                  onChange={(e) => handleUpdateItem(item.id, { quantity: parseInt(e.target.value, 10) || 1 })}
                  className="w-12 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-center font-mono font-bold text-xs text-amber-400 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Item name"
                  value={item.name}
                  onChange={(e) => handleUpdateItem(item.id, { name: e.target.value })}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Special instructions"
                  value={item.notes || ''}
                  onChange={(e) => handleUpdateItem(item.id, { notes: e.target.value })}
                  className="w-1/3 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-amber-400/90 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.id)}
                  className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!customerName.trim() || items.length === 0}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-lg shadow-orange-500/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>Broadcast Ticket</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
