import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../lib/api';
import Button from '../components/ui/Button';

export default function LoginScreen() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: () => navigate('/dashboard')
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(160deg,#0f172a,#1f9d8b)] p-5">
      <motion.form
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={(event) => {
          event.preventDefault();
          loginMutation.mutate({ username, password, remember: true });
        }}
        className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 shadow-soft"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">DormFlow Student</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Sign In</h1>
          <p className="mt-1 text-sm text-slate-500">Mobile-first student workspace</p>
        </div>

        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Username"
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none ring-coral focus:ring"
        />
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          placeholder="Password"
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none ring-coral focus:ring"
        />

        {loginMutation.error ? (
          <p className="rounded-xl bg-red-100 px-3 py-2 text-xs text-red-700">Invalid credentials or session error.</p>
        ) : null}

        <Button
          disabled={loginMutation.isPending}
          className="w-full disabled:opacity-60"
        >
          {loginMutation.isPending ? 'Signing in...' : 'Continue'}
        </Button>
      </motion.form>
    </div>
  );
}
