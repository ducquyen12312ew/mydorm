import { useQuery } from '@tanstack/react-query';
import { fetchMe } from '../lib/api';

export default function ProfileScreen() {
  const { data } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe
  });

  const user = data?.user;

  return (
    <section className="space-y-4">
      <header className="rounded-3xl bg-white p-5 shadow-soft dark:bg-slate-900">
        <h1 className="text-xl font-bold">Profile</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your student identity and preferences.</p>
      </header>

      <article className="rounded-3xl bg-white p-5 shadow-soft dark:bg-slate-900">
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Name</dt>
            <dd className="font-semibold">{user?.name || '--'}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Student ID</dt>
            <dd className="font-semibold">{user?.studentId || '--'}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Email</dt>
            <dd className="font-semibold">{user?.email || '--'}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Priority Score</dt>
            <dd className="font-semibold">{user?.priorityScore || 0}</dd>
          </div>
        </dl>
      </article>
    </section>
  );
}
