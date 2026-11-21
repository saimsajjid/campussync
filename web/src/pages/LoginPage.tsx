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
      addToast(`Signed in as ${user.name}`, 'info');
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
      addToast(`Signed in as ${u.name}`, 'info');
    } catch (err: any) {
      addToast(`Login failed: ${err.message}`, 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center items-center p-4 sm:p-6 text-zinc-900 relative">
      {/* Centered Login Card - Official shadcn UI Zinc style */}
      <div className="w-full max-w-[420px] bg-white border border-zinc-200/90 rounded-xl shadow-sm p-7 sm:p-8">
        {/* Header */}
        <div className="text-center mb-6 flex flex-col items-center">
          <BrandLogo className="w-12 h-12 mb-3.5 shadow-2xs" />
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Sign in to CampusSync
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            University Student Information & Offline Sync System
          </p>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleManualLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">
              University Email or Reg ID
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@campussync.local"
                required
                className="w-full pl-9 pr-3.5 py-2 bg-transparent border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-zinc-950 transition-colors"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-zinc-700">
                Password
              </label>
              <button
                type="button"
                onClick={() => addToast('Default demo password is: password123', 'info')}
                className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full pl-9 pr-3.5 py-2 bg-transparent border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-zinc-950 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-zinc-300 text-zinc-900 focus:ring-0 w-3.5 h-3.5 cursor-pointer accent-zinc-900"
              />
              <span>Remember this device</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-10 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-50 font-medium text-sm transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer mt-2"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        {/* Demo Quick Access */}
        <div className="mt-6 pt-5 border-t border-zinc-100">
          <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-2.5">
            <span className="font-medium">Quick Demo Role Login:</span>
            <span className="text-[10px] text-zinc-400 font-mono">1-click</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleDemoLogin(DEMO_USERS[0])}
              className="py-2 px-2.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-lg text-center transition-colors cursor-pointer group"
            >
              <div className="font-semibold text-xs text-zinc-900 group-hover:text-zinc-950">Admin</div>
              <div className="text-[10px] text-zinc-500">Registrar</div>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleDemoLogin(DEMO_USERS[1])}
              className="py-2 px-2.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-lg text-center transition-colors cursor-pointer group"
            >
              <div className="font-semibold text-xs text-zinc-900 group-hover:text-zinc-950">Faculty</div>
              <div className="text-[10px] text-zinc-500">Lahore</div>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleDemoLogin(DEMO_USERS[2])}
              className="py-2 px-2.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-lg text-center transition-colors cursor-pointer group"
            >
              <div className="font-semibold text-xs text-zinc-900 group-hover:text-zinc-950">Student</div>
              <div className="text-[10px] text-zinc-500">Ali Raza</div>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-xs text-zinc-400">
        CampusSync Multi-Campus Information System • v1.0
      </div>
    </div>
  );
};
