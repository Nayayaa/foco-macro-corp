import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ScatterChart, Scatter, ZAxis,
} from "recharts";
import { useData } from "@/lib/useData";
import { useFilters, inFilters } from "@/lib/filters";
import { SECTOR_HEX, fmtNum } from "@/lib/data";
import { PageHeader, Kpi, Panel, Loading, ChartTooltip } from "@/components/ui-bits";

export const Route = createFileRoute("/mercado")({
  head: () => ({ meta: [
    { title: "Mercado & Valuation — Brasil em Foco" },
    { name: "description", content: "Preço, market cap, P/L e EV/EBITDA das empresas listadas." },
    { property: "og:title", content: "Mercado & Valuation — Empresas Brasileiras" },
    { property: "og:description", content: "Indicadores de mercado e valuation entre 2014 e 2024." },
  ]}),
  component: Page,
});

function Page() {
  const data = useData();
  const filters = useFilters();
  const [empresa, setEmpresa] = useState("ALL");

  const all = data?.mercado ?? [];
  const empresas = useMemo(() => Array.from(new Set(all.map(r => r.empresa_nome))).filter(Boolean).sort(), [all]);

  const rows = useMemo(() => all.filter(r => inFilters(r, filters)), [all, filters]);

  if (!data) return <Loading />;

  const cap = (n?: number | null) => n != null && !isNaN(n);
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const avgCap = avg(rows.filter(r => cap(r.market_cap_bi)).map(r => r.market_cap_bi as number));
  const avgPL = avg(rows.filter(r => cap(r.pl_ratio) && (r.pl_ratio as number) > 0 && (r.pl_ratio as number) < 200).map(r => r.pl_ratio as number));
  const avgEV = avg(rows.filter(r => cap(r.ev_ebitda) && (r.ev_ebitda as number) > 0 && (r.ev_ebitda as number) < 100).map(r => r.ev_ebitda as number));

  // Price evolution per company (selected) or per company line if ALL
  const priceSeries = useMemo(() => {
    if (empresa === "ALL") {
      // Pivot: data_referencia × empresa
      const map = new Map<string, Record<string, number | string>>();
      rows.forEach(r => {
        if (!cap(r.preco_fechamento)) return;
        const cur = map.get(r.data_referencia) ?? { date: r.data_referencia };
        cur[r.empresa_nome] = r.preco_fechamento as number;
        map.set(r.data_referencia, cur);
      });
      return Array.from(map.values()).sort((a, b) => (a.date as string).localeCompare(b.date as string));
    }
    return rows.filter(r => r.empresa_nome === empresa && cap(r.preco_fechamento))
      .map(r => ({ date: r.data_referencia, preco: r.preco_fechamento }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [rows, empresa]);

  // P/L vs EV/EBITDA per company (avg)
  const valuationByCompany = useMemo(() => {
    const map = new Map<string, { empresa: string; pl: number; pn: number; ev: number; en: number }>();
    rows.forEach(r => {
      const cur = map.get(r.empresa_nome) ?? { empresa: r.empresa_nome, pl: 0, pn: 0, ev: 0, en: 0 };
      if (cap(r.pl_ratio) && (r.pl_ratio as number) > 0 && (r.pl_ratio as number) < 200) { cur.pl += r.pl_ratio as number; cur.pn += 1; }
      if (cap(r.ev_ebitda) && (r.ev_ebitda as number) > 0 && (r.ev_ebitda as number) < 100) { cur.ev += r.ev_ebitda as number; cur.en += 1; }
      map.set(r.empresa_nome, cur);
    });
    return Array.from(map.values()).map(v => ({
      empresa: v.empresa.split(" ")[0],
      pl: v.pn ? v.pl / v.pn : 0,
      ev: v.en ? v.ev / v.en : 0,
    })).sort((a, b) => b.pl - a.pl);
  }, [rows]);

  // Market Cap total vs Câmbio over time
  const capVsFx = useMemo(() => {
    const map = new Map<string, { date: string; cap: number; fx: number; fxN: number }>();
    rows.forEach(r => {
      const cur = map.get(r.data_referencia) ?? { date: r.data_referencia, cap: 0, fx: 0, fxN: 0 };
      if (cap(r.market_cap_bi)) cur.cap += r.market_cap_bi as number;
      if (cap(r.cambio_brl_usd)) { cur.fx += r.cambio_brl_usd as number; cur.fxN += 1; }
      map.set(r.data_referencia, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
      .map(v => ({ date: v.date, cap: v.cap, fx: v.fxN ? v.fx / v.fxN : 0 }));
  }, [rows]);

  // Scatter PL vs EV by sector
  const scatterValuation = useMemo(() => {
    const map = new Map<string, { empresa: string; setor: string; pl: number; ev: number; pn: number; en: number }>();
    rows.forEach(r => {
      const cur = map.get(r.empresa_nome) ?? { empresa: r.empresa_nome, setor: r.setor, pl: 0, ev: 0, pn: 0, en: 0 };
      if (cap(r.pl_ratio) && (r.pl_ratio as number) > 0 && (r.pl_ratio as number) < 200) { cur.pl += r.pl_ratio as number; cur.pn += 1; }
      if (cap(r.ev_ebitda) && (r.ev_ebitda as number) > 0 && (r.ev_ebitda as number) < 100) { cur.ev += r.ev_ebitda as number; cur.en += 1; }
      map.set(r.empresa_nome, cur);
    });
    const points = Array.from(map.values()).map(v => ({
      empresa: v.empresa, setor: v.setor,
      pl: v.pn ? v.pl / v.pn : 0,
      ev: v.en ? v.ev / v.en : 0,
    })).filter(p => p.pl > 0 && p.ev > 0);
    const bySector = new Map<string, typeof points>();
    points.forEach(p => {
      const arr = bySector.get(p.setor) ?? [];
      arr.push(p); bySector.set(p.setor, arr);
    });
    return Array.from(bySector.entries());
  }, [rows]);

  // Comparison table 2014, 2020, 2024
  const compYears = [2014, 2020, 2024];
  const compTable = useMemo(() => {
    return empresas.map(emp => {
      const cells = compYears.map(y => {
        const subset = all.filter(r => r.empresa_nome === emp && r.ano === y);
        const price = avg(subset.filter(r => cap(r.preco_fechamento)).map(r => r.preco_fechamento as number));
        const c = avg(subset.filter(r => cap(r.market_cap_bi)).map(r => r.market_cap_bi as number));
        const pl = avg(subset.filter(r => cap(r.pl_ratio) && (r.pl_ratio as number) > 0 && (r.pl_ratio as number) < 200).map(r => r.pl_ratio as number));
        const ev = avg(subset.filter(r => cap(r.ev_ebitda) && (r.ev_ebitda as number) > 0 && (r.ev_ebitda as number) < 100).map(r => r.ev_ebitda as number));
        return { y, price, c, pl, ev };
      });
      return { empresa: emp, cells };
    });
  }, [all, empresas]);

  // Color for line per company
  const COMPANY_COLORS = ["#FF6B35", "#00D4AA", "#F2C94C", "#9B5DE5", "#56CCF2", "#E94B3C", "#6FCF97", "#F2994A", "#BB6BD9"];

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Página 04"
        title="Análise de Mercado e Valuation"
        subtitle="Preço, capitalização e múltiplos de mercado das nove empresas selecionadas."
      />

      <div className="px-10 pt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi label="Market Cap — Médio" value={`R$ ${fmtNum(avgCap, 1)} bi`} accent="orange" />
        <Kpi label="P/L — Médio" value={fmtNum(avgPL, 1) + "x"} accent="green" />
        <Kpi label="EV / EBITDA — Médio" value={fmtNum(avgEV, 1) + "x"} accent="yellow" />
      </div>

      <div className="px-10 pt-6">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Empresa</div>
        <select value={empresa} onChange={(e) => setEmpresa(e.target.value)}
          className="bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground min-w-[220px]">
          <option value="ALL">Todas as empresas</option>
          {empresas.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      <div className="px-10 mt-6 space-y-6">
        <Panel title="Preço de Fechamento — Evolução"
          subtitle={empresa === "ALL" ? "Todas as empresas." : empresa}>
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceSeries as any[]} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
                <CartesianGrid stroke="oklch(0.4 0.04 250 / 0.25)" strokeDasharray="2 4" />
                <XAxis dataKey="date" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} interval={11} />
                <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                <Tooltip content={<ChartTooltip formatter={(v) => `R$ ${fmtNum(v, 2)}`} />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {empresa === "ALL"
                  ? empresas.map((e, i) => (
                      <Line key={e} type="monotone" dataKey={e} name={e.split(" ")[0]} stroke={COMPANY_COLORS[i % COMPANY_COLORS.length]}
                        strokeWidth={1.6} dot={false} connectNulls />
                    ))
                  : <Line type="monotone" dataKey="preco" name={empresa} stroke="#FF6B35" strokeWidth={2.5} dot={false} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel title="P/L e EV / EBITDA — Comparativo" subtitle="Médias por empresa no período.">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={valuationByCompany} margin={{ top: 10, right: 12, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="oklch(0.4 0.04 250 / 0.25)" strokeDasharray="2 4" />
                  <XAxis dataKey="empresa" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip formatter={(v) => fmtNum(v, 1) + "x"} />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="pl" name="P/L" fill="#FF6B35" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="ev" name="EV / EBITDA" fill="#00D4AA" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Market Cap Agregado vs Câmbio BRL/USD" subtitle="Capitalização total (esquerda) e câmbio (direita).">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={capVsFx} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="oklch(0.4 0.04 250 / 0.25)" strokeDasharray="2 4" />
                  <XAxis dataKey="date" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} interval={11} />
                  <YAxis yAxisId="L" orientation="left" tick={{ fill: "#FF6B35", fontSize: 11 }} tickFormatter={(v) => `${(v).toFixed(0)}b`} />
                  <YAxis yAxisId="R" orientation="right" tick={{ fill: "#00D4AA", fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip formatter={(v, n) => n.includes("Câmbio") ? `R$ ${fmtNum(v, 2)}` : `R$ ${fmtNum(v, 1)} bi`} />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="L" type="monotone" dataKey="cap" name="Market Cap (R$ bi)" stroke="#FF6B35" strokeWidth={2.5} dot={false} />
                  <Line yAxisId="R" type="monotone" dataKey="fx" name="Câmbio BRL/USD" stroke="#00D4AA" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        <Panel title="P/L × EV/EBITDA — Por Setor" subtitle="Médias por empresa, coloridas pelo setor.">
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="oklch(0.4 0.04 250 / 0.25)" strokeDasharray="2 4" />
                <XAxis dataKey="pl" name="P/L" type="number" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  label={{ value: "P/L", fill: "var(--color-muted-foreground)", fontSize: 11, position: "insideBottom", offset: -2 }} />
                <YAxis dataKey="ev" name="EV/EBITDA" type="number" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                <ZAxis range={[120, 120]} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-[oklch(0.18_0.04_250/0.95)] border border-border/60 rounded-md px-3 py-2 text-xs">
                        <div className="font-semibold">{d.empresa}</div>
                        <div className="text-muted-foreground">{d.setor}</div>
                        <div>P/L: {fmtNum(d.pl, 1)}x</div>
                        <div>EV/EBITDA: {fmtNum(d.ev, 1)}x</div>
                      </div>
                    );
                  }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {scatterValuation.map(([s, pts]) => (
                  <Scatter key={s} name={s} data={pts} fill={SECTOR_HEX[s] ?? "#888"} />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Indicadores de Mercado — 2014 vs 2020 vs 2024" subtitle="Preço médio, market cap, P/L e EV/EBITDA por empresa.">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border/60">
                  <th rowSpan={2} className="text-left py-2 px-3 font-medium">Empresa</th>
                  {compYears.map(y => (
                    <th key={y} colSpan={4} className="text-center px-2 py-1.5 font-medium border-l border-border/40">
                      {y === 2020 ? "2020 (Pandemia)" : y}
                    </th>
                  ))}
                </tr>
                <tr className="text-muted-foreground text-[10px]">
                  {compYears.map(y => (
                    <Fragment key={y}>
                      <th className="px-2 py-1 font-normal border-l border-border/40">Preço</th>
                      <th className="px-2 py-1 font-normal">Cap (bi)</th>
                      <th className="px-2 py-1 font-normal">P/L</th>
                      <th className="px-2 py-1 font-normal">EV/EBITDA</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compTable.map(r => (
                  <tr key={r.empresa} className="border-t border-border/40">
                    <td className="py-2 px-3 text-foreground">{r.empresa}</td>
                    {r.cells.map((c, i) => (
                      <Fragment key={i}>
                        <td className="text-right px-2 py-2 font-mono text-foreground border-l border-border/40">{c.price ? `R$ ${fmtNum(c.price, 2)}` : "—"}</td>
                        <td className="text-right px-2 py-2 font-mono text-foreground">{c.c ? fmtNum(c.c, 1) : "—"}</td>
                        <td className="text-right px-2 py-2 font-mono text-foreground">{c.pl ? fmtNum(c.pl, 1) + "x" : "—"}</td>
                        <td className="text-right px-2 py-2 font-mono text-foreground">{c.ev ? fmtNum(c.ev, 1) + "x" : "—"}</td>
                      </Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
