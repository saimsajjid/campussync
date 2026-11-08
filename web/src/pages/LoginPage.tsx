import React, { useState } from 'react';
import { useApp, DEMO_USERS } from '../context/AppContext';
import { ShieldCheck, GraduationCap, UserCheck, Key, Lock, Mail, ArrowRight, Server, Database, RefreshCw } from 'lucide-react';
import type { CurrentUser } from '../types';

export const LoginPage: React.FC = () => {
  const { setCurrentUser, addToast } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDemoLogin = (user: CurrentUser) => {
    setCurrentUser(user);
    addToast(`Signed in as ${user.name} (${user.role.toUpperCase()})`, 'success');
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      addToast('Please enter both email and password.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Invalid email or password');
      }

      const data = await res.json();
      const matched = DEMO_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase()) || {
        id: data.user?.id || 'custom-user-' + Date.now(),
        name: data.user?.name || email.split('@')[0],
        email: email,
        role: data.user?.role || 'student',
        campus: data.user?.campus || 'Lahore',
      };

      setCurrentUser(matched);
      addToast(`Signed in successfully as ${matched.name}`, 'success');
    } catch (err: any) {
      addToast(`Login failed: ${err.message}`, 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] flex flex-col justify-center items-center p-4 sm:p-6 text-white">
      {/* Brand Header */}
      <div className="text-center mb-8 max-w-md">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-xl shadow-blue-500/25 mb-4">
          <GraduationCap className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
          CampusSync
        </h1>
        <p className="text-sm text-slate-400">
          Resilient Multi-Campus Student Record & Distributed Sync System
        </p>
      </div>

      <div className="w-full max-w-xl bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8">
        {/* Fast Demo Account Access */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-blue-400" /> 1-Click Demo Profiles (Challenge HS-0146)
            </h2>
            <span className="text-[11px] bg-blue-500/10 text-blue-400 px-2.5 py-0.5 rounded-full border border-blue-500/20 font-medium">
              Demo Ready
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Admin Profile */}
            <button
              onClick={() => handleDemoLogin(DEMO_USERS[0])}
              className="group text-left p-4 rounded-xl border border-slate-800 bg-slate-800/40 hover:bg-blue-950/40 hover:border-blue-500/50 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="font-semibold text-xs text-white">Central Admin</div>
                <div className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                  Cross-campus, conflicts & audit
                </div>
              </div>
              <div className="mt-3 text-[10px] font-bold text-blue-400 flex items-center gap-1">
                Enter as Admin <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* Faculty Profile */}
            <button
              onClick={() => handleDemoLogin(DEMO_USERS[1])}
              className="group text-left p-4 rounded-xl border border-slate-800 bg-slate-800/40 hover:bg-emerald-950/40 hover:border-emerald-500/50 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="font-semibold text-xs text-white">Prof. Ahmed</div>
                <div className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                  Faculty (Lahore Campus)
                </div>
              </div>
              <div className="mt-3 text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                Enter as Faculty <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* Student Profile */}
            <button
              onClick={() => handleDemoLogin(DEMO_USERS[2])}
              className="group text-left p-4 rounded-xl border border-slate-800 bg-slate-800/40 hover:bg-indigo-950/40 hover:border-indigo-500/50 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div className="font-semibold text-xs text-white">Ali Raza</div>
                <div className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                  Student (Contact Outbox)
                </div>
              </div>
              <div className="mt-3 text-[10px] font-bold text-indigo-400 flex items-center gap-1">
                Enter as Student <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <span className="relative px-3 bg-slate-900 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
            Or Sign In With Email
          </span>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleManualLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@campussync.local"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              onClick={() => {
                setEmail('admin@campussync.local');
                setPassword('admin123');
              }}
              className="text-slate-400 hover:text-blue-400 transition-colors"
            >
              Auto-fill admin credentials
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Authenticating...
              </>
            ) : (
              'Sign In to CampusSync'
            )}
          </button>
        </form>

        {/* Offline & Architecture Callout */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span>Dexie IndexedDB Outbox</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            <span>PostgreSQL Ledger Sync</span>
          </div>
        </div>
      </div>
    </div>
  );
};
