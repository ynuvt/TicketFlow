import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Ticket, Lock, User, KeyRound, AlertCircle, ChefHat, ArrowRight } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, isLoading } = useAuth();
  const [username, setUsername] = useState<string>('admin');
  const [password, setPassword] = useState<string>('admin123');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const success = await login(username, password);
    if (!success) {
      setErrorMsg('Invalid username or password. Please try again.');
    }
  };

  const fillQuickLogin = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
        {/* Brand Header & Chef Logo */}
        <div className="text-center space-y-3 mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 p-1 shadow-lg shadow-amber-500/20 mb-1">
            <img src="/logo.png" alt="Chef Logo" className="w-full h-full object-contain bg-white rounded-xl p-1" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">TicketFlow KDS</h1>
            <p className="text-xs text-amber-400 font-semibold mt-1">Kitchen Display System & Station Auth</p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Username</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Password</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to Station</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Credentials Preset Cards */}
        <div className="mt-8 pt-6 border-t border-slate-700/80 space-y-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
            Quick Admin & Staff Presets
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => fillQuickLogin('admin', 'admin123')}
              className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/70 hover:border-amber-500/60 text-left transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <ChefHat className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-bold text-white">Admin Manager</span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">admin / admin123</p>
            </button>

            <button
              onClick={() => fillQuickLogin('cook1', 'pass123')}
              className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/70 hover:border-amber-500/60 text-left transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs font-bold text-white">Prep & Grill Cook</span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">cook1 / pass123</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
