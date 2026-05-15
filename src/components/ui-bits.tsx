import { Component, type ReactNode, type ErrorInfo } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Chart error:", error, info); }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground p-6">
          Erro ao carregar este gráfico.
        </div>
      );
    }
    return this.props.children;
  }
}

export function NoData({ message = "Dados não disponíveis" }: { message?: string }) {
  return (
    <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground p-6">
      {message}
    </div>
  );
}

export function hasData<T>(arr: T[] | null | undefined): arr is T[] {
  return Array.isArray(arr) && arr.length > 0;
}


export function PageHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <header className="px-10 pt-10 pb-6 border-b border-border/40">
      <div className="text-[11px] tracking-[0.25em] uppercase text-[var(--orange)] font-semibold">{eyebrow}</div>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h2>
      {subtitle && <p className="mt-2 text-sm text-muted-foreground max-w-3xl">{subtitle}</p>}
    </header>
  );
}

export function Kpi({ label, value, delta, hint, accent = "orange" }: {
  label: string; value: string; delta?: string; hint?: string; accent?: "orange" | "green" | "red" | "yellow" | "blue";
}) {
  const color = `var(--${accent})`;
  return (
    <div className="bg-card rounded-lg p-5 border border-border/40">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
      {delta && <div className="mt-1 text-xs font-medium" style={{ color }}>{delta}</div>}
      {hint && <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Panel({ title, subtitle, children, className = "" }: {
  title: string; subtitle?: string; children: ReactNode; className?: string;
}) {
  return (
    <section className={`bg-card rounded-lg p-5 border border-border/40 ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export function Loading() {
  return <div className="p-10 text-sm text-muted-foreground">Carregando dados…</div>;
}

export function ChartTooltip({ active, payload, label, formatter }: {
  active?: boolean; payload?: Array<{ name: string; value: number; color: string; dataKey: string }>; label?: string | number;
  formatter?: (v: number, name: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[oklch(0.18_0.04_250/0.95)] border border-border/60 rounded-md px-3 py-2 text-xs shadow-xl">
      {label != null && <div className="text-muted-foreground mb-1">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-foreground">{p.name}: <span className="font-mono">{formatter ? formatter(p.value, p.name) : p.value}</span></span>
        </div>
      ))}
    </div>
  );
}
