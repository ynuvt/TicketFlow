import React from 'react';
import { Phone, User, MessageSquare, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const HelpView: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-md mx-auto my-12 font-sans">
      <div className="bg-white border border-slate-200/80 rounded-3xl shadow-xl overflow-hidden">
        {/* Header Block */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white text-center space-y-3">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto backdrop-blur-sm border border-white/10">
            <Phone className="w-7 h-7 text-white animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Manager Help Desk</h2>
            <p className="text-[11px] text-blue-100 font-medium">TicketFlow Kitchen Assistance Hotline</p>
          </div>
        </div>

        {/* Content Block */}
        <div className="p-6 space-y-6">
          <div className="text-center space-y-1">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Contact Kitchen Manager</p>
            <a
              href="tel:+919988776655"
              className="text-2xl font-extrabold text-blue-600 hover:text-blue-700 transition-colors block font-mono"
            >
              +91 99887 76655
            </a>
          </div>

          <div className="border-t border-slate-100 pt-5 space-y-4 text-xs font-medium text-slate-600">
            <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <User className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800">Need Station Permissions?</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Your current account (<strong>@{user?.username}</strong>) has access to limited stations. Contact the manager to assign new permissions.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800">Workload or Sliding Window Issues?</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  If the 20-minute sliding window queue needs average prep time adjustments, the manager can configure them dynamically in Staff Management.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
          <p className="text-[10px] text-slate-400 font-mono">TicketFlow KDS v1.0 • Authorized Staff Support</p>
        </div>
      </div>
    </div>
  );
};
