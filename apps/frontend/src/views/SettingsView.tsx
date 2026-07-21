import React from 'react';
import { Settings, Sliders, Shield, Database, Radio } from 'lucide-react';

export const SettingsView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6 max-w-3xl">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            KDS System Configuration
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure station routing rules, WebSocket reconnect parameters, and distributed lock parameters
          </p>
        </div>

        <div className="space-y-4 text-xs">
          <div className="border border-slate-200/80 p-4 rounded-xl space-y-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Radio className="w-4 h-4 text-blue-600" /> WebSocket & Event Store Engine
            </h3>
            <p className="text-slate-500">
              Protocol: Monotonic Total-Ordering Sequence Sourcing
            </p>
            <p className="text-slate-500">
              Backend Server Endpoint: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-600 font-mono">http://localhost:4000</code>
            </p>
          </div>

          <div className="border border-slate-200/80 p-4 rounded-xl space-y-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-600" /> Monorepo Architecture
            </h3>
            <p className="text-slate-500">
              Clean Architecture with Turborepo monorepo setup (`@ticketflow/frontend`, `@ticketflow/backend`, `@ticketflow/types`).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
