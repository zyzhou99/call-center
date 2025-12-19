"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const { user, login, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.push('/inbox');
    }
  }, [user, isLoading, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    const success = login(email, password);
    if (success) {
      router.push('/inbox');
    } else {
      setError('Invalid email or password');
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <div className="min-h-screen flex overflow-hidden">
      <div
        className="relative flex-1 bg-cover bg-center"
        style={{
          backgroundImage: 'url(https://images.pexels.com/photos/258154/pexels-photo-258154.jpeg?auto=compress&cs=tinysrgb&w=1920)',
          clipPath: 'polygon(0 0, 100% 0, 75% 100%, 0 100%)'
        }}
      >
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 p-12">
          <div className="text-white font-serif italic text-5xl" style={{ fontFamily: 'Brush Script MT, cursive' }}>
            Wynn
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center relative" style={{ backgroundColor: '#F9F8F6' }}>
        <div
          className="absolute bottom-24 right-24 text-9xl font-serif italic opacity-5 pointer-events-none select-none"
          style={{ fontFamily: 'Brush Script MT, cursive', color: '#9C7D47' }}
        >
          Wynn
        </div>

        <div className="w-full max-w-md px-12 relative z-10">
          <div className="text-center mb-8">
            <h2 className="text-sm font-semibold tracking-widest mb-4" style={{ color: '#9C7D47' }}>
              WYNN PALACE
            </h2>
            <h1 className="text-4xl font-serif mb-3" style={{ color: '#444343' }}>
              Hotel Service Hub
            </h1>
            <p className="text-sm" style={{ color: '#989795' }}>
              Welcome Back, Please login to your account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-xs font-semibold tracking-widest"
                style={{ color: '#444343' }}
              >
                EMAIL ADDRESS
              </label>
              <input
                id="email"
                type="email"
                placeholder="admin@wynnpalace.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{
                  borderColor: '#E8E7E4',
                  backgroundColor: '#FFFFFF',
                  color: '#444343'
                }}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-xs font-semibold tracking-widest"
                style={{ color: '#444343' }}
              >
                PASSWORD
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{
                  borderColor: '#E8E7E4',
                  backgroundColor: '#FFFFFF',
                  color: '#444343'
                }}
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-2 cursor-pointer"
                  style={{ borderColor: '#E8E7E4', accentColor: '#9C7D47' }}
                />
                <span className="text-sm" style={{ color: '#444343' }}>
                  Remember me
                </span>
              </label>
              <button
                type="button"
                className="text-sm hover:underline"
                style={{ color: '#9C7D47' }}
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-lg font-semibold tracking-wide text-sm transition-all hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, #D4AF6A 0%, #C4A45E 50%, #B89850 100%)',
                color: '#FFFFFF',
                boxShadow: '0 2px 8px rgba(156, 125, 71, 0.2)'
              }}
            >
              LOGIN
            </button>
          </form>

          <div className="mt-12 text-center text-xs" style={{ color: '#989795' }}>
            © 2025 Wynn Palace Cotai. | Powered by AcmePure Technology & Services Limited
          </div>
        </div>
      </div>
    </div>
  );
}
