export default function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-3xl bg-white p-4 shadow-soft dark:bg-slate-900">
      <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mt-3 h-5 w-40 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mt-4 h-24 rounded-2xl bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}
