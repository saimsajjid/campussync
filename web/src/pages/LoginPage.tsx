import React, { useState } from 'react';
import { useApp, DEMO_USERS } from '../context/AppContext';
import { Lock, Mail, RefreshCw } from 'lucide-react';
import type { CurrentUser } from '../types';
import { BrandLogo } from '../components/BrandLogo';

export const LoginPage: React.FC = () => {
  const { login, addToast } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDemoLogin = async (user: CurrentUser) => {
    setIsSubmitting(true);
    setEmail(user.email);
    setPassword('password123');
    try {
      await login(user.email, 'password123');
      addToast(`Signed in as ${user.name}`, 'success');
    } catch (err: any) {
      addToast(`Login failed: ${err.message}`, 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      addToast('Please enter both email and password.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const u = await login(email, password);
      addToast(`Signed in as ${u.name}`, 'success');
    } catch (err: any) {
      addToast(`Login failed: ${err.message}`, 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-900">
      {/* Centered Login Card */}
      <div className="w-full max-w-[420px] bg-white border border-slate-200/80 rounded-2xl shadow-xs p-7 sm:p-8">
        {/* Header */}
        <div className="text-center mb-7 flex flex-col items-center">
          <BrandLogo className="w-12 h-12 mb-3.5 shadow-sm" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Sign in to CampusSync
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            University Student Information & Sync System
          </p>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleManualLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              University Email or Reg ID
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@campussync.local"
                required
                className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-700">
                Password
              </label>
              <button
                type="button"
                onClick={() => addToast('Default demo password is: password123', 'info')}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800 transition-colors"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-300 text-slate-900 focus:ring-0 w-3.5 h-3.5"
              />
              <span>Remember this device</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer mt-2"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-300" />
                <span>Signing in...</span>
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        {/* Discrete Demo Quick Access for Evaluators */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
            <span>Quick demo access:</span>
            <span className="text-[10px] text-slate-400 font-mono">1-click test</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleDemoLogin(DEMO_USERS[0])}
              className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-lg text-left text-slate-700 transition-all cursor-pointer text-center"
            >
              <div className="font-semibold text-[11px] text-slate-900">Admin</div>
              <div className="text-[9px] text-slate-500">Registrar</div>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleDemoLogin(DEMO_USERS[1])}
              className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-lg text-left text-slate-700 transition-all cursor-pointer text-center"
            >
              <div className="font-semibold text-[11px] text-slate-900">Faculty</div>
              <div className="text-[9px] text-slate-500">Lahore</div>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleDemoLogin(DEMO_USERS[2])}
              className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-lg text-left text-slate-700 transition-all cursor-pointer text-center"
            >
              <div className="font-semibold text-[11px] text-slate-900">Student</div>
              <div className="text-[9px] text-slate-500">Ali Raza</div>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-[11px] text-slate-400">
        CampusSync Multi-Campus Information System • v1.0
      </div>
    </div>
  );
};
