export default function Button({ children, className = '', variant = 'primary', ...props }) {
  const variants = {
    primary: 'bg-gradient-to-r from-coral to-amber-400 text-white shadow-soft',
    ghost: 'bg-slate-100 text-ink dark:bg-slate-800 dark:text-slate-100'
  };

  return (
    <button
      className={`rounded-[var(--radius-pill)] px-[var(--space-4)] py-[var(--space-3)] text-sm font-semibold transition active:scale-[0.98] ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
