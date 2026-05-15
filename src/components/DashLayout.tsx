import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { FilterProvider, useFilters } from "@/lib/filters";
import { SHOCK_LABEL } from "@/lib/data";

const NAV = [
  { to: "/", label: "Macroeconomia", num: "01" },
  { to: "/empresas", label: "Empresas & Setores", num: "02" },
  { to: "/selic", label: "Selic vs Alavancagem", num: "03" },
  { to: "/mercado", label: "Mercado & Valuation", num: "04" },
];

function GlobalFilters() {
  const { yearRange, setYearRange, shock, setShock } = useFilters();
  return (
    <div className="space-y-5 px-5 py-5 border-t border-border/40">
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Período</span>
          <span className="text-xs text-foreground font-mono">{yearRange[0]} – {yearRange[1]}</span>
        </div>
        <div className="space-y-2">
          <input type="range" min={2014} max={2024} value={yearRange[0]}
            onChange={(e) => setYearRange([Math.min(+e.target.value, yearRange[1]), yearRange[1]])}
            className="w-full accent-[var(--orange)]" />
          <input type="range" min={2014} max={2024} value={yearRange[1]}
            onChange={(e) => setYearRange([yearRange[0], Math.max(+e.target.value, yearRange[0])])}
            className="w-full accent-[var(--orange)]" />
        </div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Choque</div>
        <select value={shock} onChange={(e) => setShock(e.target.value)}
          className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground">
          <option value="ALL">Todos os períodos</option>
          {Object.entries(SHOCK_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Sidebar() {
  const loc = useLocation();
  return (
    <aside className="w-64 shrink-0 bg-sidebar border-r border-border/40 flex flex-col h-screen sticky top-0">
      <div className="px-5 py-6 border-b border-border/40">
        <div className="text-[10px] tracking-[0.25em] text-[var(--orange)] uppercase font-semibold">Brasil em Foco</div>
        <h1 className="mt-1 text-[15px] font-semibold leading-tight text-foreground">
          Anatomia de<br/>Três Choques
        </h1>
        <div className="mt-2 text-[10px] text-muted-foreground">2014 — 2024</div>
      </div>
      <nav className="flex-1 py-3">
        {NAV.map((n) => {
          const active = loc.pathname === n.to;
          return (
            <Link key={n.to} to={n.to}
              className={`flex items-center gap-3 px-5 py-3 text-sm transition-colors border-l-2 ${
                active
                  ? "border-[var(--orange)] bg-[oklch(0.27_0.045_250/0.5)] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-[oklch(0.27_0.045_250/0.3)]"
              }`}>
              <span className="font-mono text-[10px] text-[var(--orange)]">{n.num}</span>
              <span>{n.label}</span>
            </Link>
          );
        })}
      </nav>
      <GlobalFilters />
      <div className="px-5 py-3 text-[10px] text-muted-foreground border-t border-border/40">
        Fontes: IPEADATA, CVM, B3, Yahoo Finance
      </div>
    </aside>
  );
}

export default function DashLayout() {
  return (
    <FilterProvider>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </FilterProvider>
  );
}
