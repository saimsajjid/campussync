import React, { useState } from 'react';
import { useApp, DEMO_USERS } from '../context/AppContext';
import { ShieldCheck, GraduationCap, UserCheck, Key, Lock, Mail, ArrowRight, RefreshCw } from 'lucide-react';
import type { CurrentUser } from '../types';

export const LoginPage: React.FC = () => {
  const { login, addToast, isDemoMode } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDemoLogin = async (user: CurrentUser) => {
    setIsSubmitting(true);
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
    <div className="min-h-screen bg-[var(--color-background)] flex flex-col justify-center items-center p-4 sm:p-6 text-[var(--color-text-dark)]">
      {/* Brand Header */}
      <div className="text-center mb-6 max-w-md">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--color-primary)] text-white shadow-xs mb-3">
          <GraduationCap className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--color-text-dark)] mb-1">
          CampusSync
        </h1>
        <p className="text-xs sm:text-sm text-[var(--color-text-muted)]">
          Student records for every campus, online or offline.
        </p>
      </div>

      <div className="w-full max-w-xl bg-white border border-[var(--color-border-subtle)] rounded-2xl shadow-xs p-6 sm:p-8">
        {/* Fast Demo Account Access */}
        {isDemoMode && (
          <>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-[var(--color-primary)]" /> Demo accounts
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Admin Profile */}
                <button
                  type="button"
                  onClick={() => handleDemoLogin(DEMO_USERS[0])}
                  className="group text-left p-3.5 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-primary)] transition-all flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center mb-2">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="font-semibold text-xs text-[var(--color-text-dark)]">Central Admin</div>
                    <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5 leading-tight">
                      Full access
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] font-bold text-[var(--color-primary)] flex items-center gap-1">
                    Sign in <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>

                {/* Faculty Profile */}
                <button
                  type="button"
                  onClick={() => handleDemoLogin(DEMO_USERS[1])}
                  className="group text-left p-3.5 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-primary)] transition-all flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div className="font-semibold text-xs text-[var(--color-text-dark)]">Prof. Ahmed</div>
                    <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5 leading-tight">
                      Faculty (Lahore)
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                    Sign in <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>

                {/* Student Profile */}
                <button
                  type="button"
                  onClick={() => handleDemoLogin(DEMO_USERS[2])}
                  className="group text-left p-3.5 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-primary)] transition-all flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div className="font-semibold text-xs text-[var(--color-text-dark)]">Ali Raza</div>
                    <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5 leading-tight">
                      Student (Lahore)
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] font-bold text-indigo-600 flex items-center gap-1">
                    Sign in <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="relative my-5 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--color-border-subtle)]"></div>
              </div>
              <span className="relative px-3 bg-white text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">
                Or sign in with email
              </span>
            </div>
          </>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleManualLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-dark)] mb-1.5">
              Email address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@campussync.local"
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-[var(--color-border-muted)] rounded-xl text-xs text-[var(--color-text-dark)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-dark)] mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-[var(--color-border-muted)] rounded-xl text-xs text-[var(--color-text-dark)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              onClick={() => {
                setEmail('admin@campussync.local');
                setPassword('password123');
              }}
              className="text-xs font-semibold text-[var(--color-primary)] hover:underline transition-colors cursor-pointer"
            >
              Fill admin credentials
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Authenticating...
              </>
            ) : (
              'Sign in to CampusSync'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
