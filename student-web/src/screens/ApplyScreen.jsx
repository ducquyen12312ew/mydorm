import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { fetchRegistrationWindow, scorePreview } from '../lib/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function ApplyScreen() {
  const [form, setForm] = useState({
    yearGroup: 'year1',
    gpa: 3.2,
    distanceFromHome: 80,
    familyWealth: 'average',
    priorityPolicies: []
  });

  const previewMutation = useMutation({ mutationFn: scorePreview });
  const windowQuery = useQuery({ queryKey: ['registration-window'], queryFn: fetchRegistrationWindow });

  const canApply = useMemo(() => !!windowQuery.data?.openForRegistration, [windowQuery.data]);

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-xl font-bold">Apply For Dorm</h1>
        <p className="mt-1 text-sm text-slate-500">Use score preview before final submission.</p>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-slate-700">Registration Window</p>
        <p className="mt-2 text-sm text-slate-500">
          {canApply ? 'Open now. You can submit using existing backend endpoint /api/registration.' : 'No active cycle right now.'}
        </p>
      </Card>

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          previewMutation.mutate(form);
        }}
      >
        <Card>
        <label className="block text-sm font-medium">GPA</label>
        <input
          type="number"
          step="0.1"
          min="0"
          max="4"
          className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          value={form.gpa}
          onChange={(event) => setForm((prev) => ({ ...prev, gpa: event.target.value }))}
        />

        <label className="block text-sm font-medium">Distance From Home (km)</label>
        <input
          type="number"
          min="0"
          className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          value={form.distanceFromHome}
          onChange={(event) => setForm((prev) => ({ ...prev, distanceFromHome: event.target.value }))}
        />

        {previewMutation.isError ? (
          <p className="rounded-xl bg-red-100 px-3 py-2 text-xs text-red-700">Could not preview score. Please verify input and retry.</p>
        ) : null}

        <Button variant="ghost" className="w-full bg-ink text-white">Preview Score</Button>
        </Card>
      </form>

      {previewMutation.data ? (
        <div className="rounded-3xl bg-gradient-to-br from-teal to-cyan-500 p-5 text-white shadow-soft">
          <p className="text-sm uppercase tracking-[0.18em] text-white/80">Live Score</p>
          <p className="mt-1 text-3xl font-bold">{previewMutation.data.total || 0}</p>
        </div>
      ) : null}
    </section>
  );
}
