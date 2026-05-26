export default function Card({ title, subtitle, children, className = '' }) {
  return (
    <section className={`rounded-[var(--radius-card)] bg-white p-[var(--space-4)] shadow-soft dark:bg-slate-900 ${className}`}>
      {title ? <h2 className="text-lg font-bold text-ink dark:text-slate-100">{title}</h2> : null}
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      <div className={title || subtitle ? 'mt-3' : ''}>{children}</div>
    </section>
  );
}
