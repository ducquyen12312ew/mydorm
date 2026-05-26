import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { fetchDashboard } from '../lib/api';
import Card from '../components/ui/Card';
import SkeletonBlock from '../components/ui/SkeletonBlock';

function StatCard({ label, value, tone = 'from-teal to-cyan-500' }) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      className={`rounded-3xl bg-gradient-to-br ${tone} p-4 text-white shadow-soft`}
    >
      <p className="text-xs uppercase tracking-[0.16em] text-white/80">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value || '--'}</p>
    </motion.div>
  );
}

export default function DashboardScreen() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <SkeletonBlock className="h-28 w-full" />
        <SkeletonBlock className="h-24 w-full" />
        <SkeletonBlock className="h-24 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card title="Dashboard unavailable" subtitle="Unable to load your latest status. Pull to refresh or try again shortly." />
    );
  }

  return (
    <section className="space-y-4">
      <Card className="rounded-3xl">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Student Dashboard</p>
        <h1 className="mt-2 text-2xl font-bold">Welcome, {data?.profile?.name || 'Student'}</h1>
        <p className="mt-1 text-sm text-slate-500">Real-time status synced across web and mobile app</p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Application" value={data?.application?.status || 'No draft'} tone="from-coral to-amber-400" />
        <StatCard label="Priority" value={data?.profile?.priorityScore || 0} />
      </div>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Assignment</p>
        <p className="mt-2 text-lg font-semibold">{data?.assignment?.roomNumber ? `Room ${data.assignment.roomNumber}` : 'Not assigned yet'}</p>
        <p className="mt-1 text-sm text-slate-500">{data?.assignment?.dormitoryName || 'Waiting for assignment result'}</p>
      </Card>
    </section>
  );
}
