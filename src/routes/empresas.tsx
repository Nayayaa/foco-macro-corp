import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ScatterChart, Scatter, ZAxis,
} from "recharts";
import { useData } from "@/lib/useData";
import { useFilters, inFilters } from "@/lib/filters";
import { SECTOR_HEX, SHOCK_LABEL, fmtNum, fmtPct } from "@/lib/data";
import type { FinRow } from "@/lib/data";
import { PageHeader, Kpi, Panel, Loading, ChartTooltip, ErrorBoundary, NoData, hasData } from "@/components/ui-bits";

export const Route = createFileRoute("/empresas")({
  head: () => ({ meta: [
    { title: "Empresas & Setores — Brasil em Foco" },
    { name: "description", content: "Análise corporativa por empresa e setor: receita, EBITDA, ROE, ROA e dívida." },
    { property: "og:title", content: "Análise Corporativa — Empresas Brasileiras" },
    { property: "og:description", content: "Indicadores financeiros de 9 empresas brasileiras across choques macroeconômicos." },
  ]}),
  component: Page,
});

function Page() {
  const data = useData();
  const filters = useFilters();
  const [empresa, setEmpresa] = useState<string>("ALL");
  const [setor, setSetor] = useState<string>("ALL");

  const allFin = data?.fin ?? [];
  const empresas = useMemo(() => Array.from(new Set(allFin.map(r => r.empresa_nome))).filter(Boolean).sort(), [allFin]);
  const setores = useMemo(() => Array.from(new Set(allFin.map(r => r.setor))).filter(Boolean).sort(), [allFin]);

  const filtered = useMemo(() => allFin.filter(r => {
    if (!inFilters(r, filters)) return false;
    if (empresa !== "ALL" && r.empresa_nome !== empresa) return false;
    if (setor !== "ALL" && r.setor !== setor) return false;
    return true;
  }), [allFin, filters, empresa, setor]);

  // Current KPIs — last quarter of selected company (or aggregate)
  const sortedByDate = useMemo(() => [...filtered].sort((a, b) => a.data_referencia.localeCompare(b.data_referencia)), [filtered]);
  const cur = useMemo(() => {
    const lastQ = sortedByDate[sortedByDate.length - 1];
    const lastForCompany = empresa === "ALL" ? null : sortedByDate.filter(r => r.empresa_nome === empresa).slice(-1)[0];
    return lastForCompany ?? lastQ ?? null;
  }, [sortedByDate, empresa]);

  // Receita & EBITDA evolution per quarter — for selected company or all aggregated
  const revenueSeries = useMemo(() => {
    try {
      const rows = filtered.filter(r => r.receita_liquida != null || r.ebitda != null);
      const map = new Map<string, { periodo: string; receita: number; ebitda: number; n: number }>();
      rows.forEach(r => {
        const c = map.get(r.periodo) ?? { periodo: r.periodo, receita: 0, ebitda: 0, n: 0 };
        c.receita += Number(r.receita_liquida) || 0;
        c.ebitda += Number(r.ebitda) || 0;
        c.n += 1;
        map.set(r.periodo, c);
      });
      return Array.from(map.values()).sort((a, b) => a.periodo.localeCompare(b.periodo));
    } catch (e) { console.error(e); return []; }
  }, [filtered]);

  // Margins by shock — average across companies grouped by shock
  const marginsByShock = useMemo(() => {
    try {
      const groups = new Map<string, { n: number; ebitda: number; liq: number; nLiq: number }>();
      filtered.forEach(r => {
        const g = groups.get(r.choque_periodo) ?? { n: 0, ebitda: 0, liq: 0, nLiq: 0 };
        if (r.margem_ebitda_pct != null && !isNaN(Number(r.margem_ebitda_pct))) { g.ebitda += Number(r.margem_ebitda_pct); g.n += 1; }
        if (r.margem_liquida_pct != null && !isNaN(Number(r.margem_liquida_pct))) { g.liq += Number(r.margem_liquida_pct); g.nLiq += 1; }
        groups.set(r.choque_periodo, g);
      });
      return Array.from(groups.entries()).map(([k, v]) => ({
        choque: SHOCK_LABEL[k] ?? k,
        margem_ebitda: v.n ? v.ebitda / v.n : 0,
        margem_liquida: v.nLiq ? v.liq / v.nLiq : 0,
      }));
    } catch (e) { console.error(e); return []; }
  }, [filtered]);

  // ROE/ROA by company
  const roeRoaByCompany = useMemo(() => {
    try {
      const groups = new Map<string, { n: number; roe: number; roa: number }>();
      filtered.forEach(r => {
        const g = groups.get(r.empresa_nome) ?? { n: 0, roe: 0, roa: 0 };
        if (r.roe_pct != null && !isNaN(Number(r.roe_pct))) g.roe += Number(r.roe_pct);
        if (r.roa_pct != null && !isNaN(Number(r.roa_pct))) g.roa += Number(r.roa_pct);
        g.n += 1;
        groups.set(r.empresa_nome, g);
      });
      return Array.from(groups.entries()).map(([nome, g]) => ({
        empresa: nome.split(" ")[0],
        roe: g.n ? g.roe / g.n : 0,
        roa: g.n ? g.roa / g.n : 0,
      })).sort((a, b) => b.roe - a.roe);
    } catch (e) { console.error(e); return []; }
  }, [filtered]);

  // Scatter EBITDA vs Divida_Liquida
  const scatterData = useMemo(() => {
    try {
      const map = new Map<string, { empresa: string; setor: string; ebitda: number; divida: number; n: number }>();
      filtered.forEach(r => {
        if (r.ebitda == null || r.divida_liquida == null) return;
        const eb = Number(r.ebitda), dv = Number(r.divida_liquida);
        if (isNaN(eb) || isNaN(dv)) return;
        const c = map.get(r.empresa_nome) ?? { empresa: r.empresa_nome, setor: r.setor, ebitda: 0, divida: 0, n: 0 };
        c.ebitda += eb; c.divida += dv; c.n += 1;
        map.set(r.empresa_nome, c);
      });
      return Array.from(map.values()).map(v => ({
        empresa: v.empresa, setor: v.setor,
        ebitda: v.n ? v.ebitda / v.n / 1000 : 0,
        divida: v.n ? v.divida / v.n / 1000 : 0,
      }));
    } catch (e) { console.error(e); return []; }
  }, [filtered]);

  const bySector = useMemo(() => {
    const map = new Map<string, typeof scatterData>();
    scatterData.forEach(d => {
      const arr = map.get(d.setor) ?? [];
      arr.push(d); map.set(d.setor, arr);
    });
    return Array.from(map.entries());
  }, [scatterData]);

  if (!data) return <Loading />;

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Página 02"
        title="Análise Corporativa por Empresa e Setor"
        subtitle="Receita, rentabilidade e endividamento de nove empresas brasileiras através dos choques."
      />

      <div className="px-10 pt-8 flex flex-wrap gap-4">
        <Selector label="Empresa" value={empresa} onChange={setEmpresa}
          options={[{ v: "ALL", l: "Todas as empresas" }, ...empresas.map(e => ({ v: e, l: e }))]} />
        <Selector label="Setor" value={setor} onChange={setSetor}
          options={[{ v: "ALL", l: "Todos os setores" }, ...setores.map(s => ({ v: s, l: s }))]} />
      </div>

      <div className="px-10 pt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Receita Líquida" value={cur?.receita_liquida != null ? `R$ ${fmtNum((cur.receita_liquida ?? 0) / 1000, 0)} M` : "—"} hint={cur?.periodo} />
        <Kpi label="EBITDA" value={cur?.ebitda != null ? `R$ ${fmtNum((cur.ebitda ?? 0) / 1000, 0)} M` : "—"} hint={cur?.periodo} accent="green" />
        <Kpi label="Margem EBITDA" value={fmtPct(cur?.margem_ebitda_pct)} accent="green" />
        <Kpi label="ROE" value={fmtPct(cur?.roe_pct)} accent="orange" />
        <Kpi label="ROA" value={fmtPct(cur?.roa_pct)} accent="orange" />
        <Kpi label="Dívida / EBITDA" value={fmtNum(cur?.divida_ebitda, 2)} accent="yellow" />
      </div>

      <div className="px-10 mt-8 space-y-6">
        <Panel title="Receita Líquida e EBITDA — Evolução Trimestral"
          subtitle={empresa === "ALL" ? "Soma trimestral de todas as empresas filtradas." : `Empresa selecionada: ${empresa}`}>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueSeries} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="oklch(0.4 0.04 250 / 0.25)" strokeDasharray="2 4" />
                <XAxis dataKey="periodo" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} interval={3} />
                <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}B`} />
                <Tooltip content={<ChartTooltip formatter={(v) => `R$ ${fmtNum(v / 1000, 0)} M`} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="receita" name="Receita Líquida" stroke="#FF6B35" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="ebitda" name="EBITDA" stroke="#00D4AA" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel title="Margem EBITDA % e Margem Líquida % por Choque" subtitle="Média entre as empresas filtradas.">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={marginsByShock} margin={{ top: 10, right: 12, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="oklch(0.4 0.04 250 / 0.25)" strokeDasharray="2 4" />
                  <XAxis dataKey="choque" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} />
                  <YAxis unit="%" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip formatter={(v) => fmtPct(v)} />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="margem_ebitda" name="Margem EBITDA" fill="#FF6B35" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="margem_liquida" name="Margem Líquida" fill="#00D4AA" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="ROE % e ROA % por Empresa" subtitle="Média no período selecionado.">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roeRoaByCompany} margin={{ top: 10, right: 12, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="oklch(0.4 0.04 250 / 0.25)" strokeDasharray="2 4" />
                  <XAxis dataKey="empresa" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
                  <YAxis unit="%" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip formatter={(v) => fmtPct(v)} />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="roe" name="ROE" fill="#FF6B35" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="roa" name="ROA" fill="#00D4AA" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        <Panel title="EBITDA × Dívida Líquida (médias por empresa)" subtitle="Cor por setor. Cada ponto representa uma empresa.">
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="oklch(0.4 0.04 250 / 0.25)" strokeDasharray="2 4" />
                <XAxis dataKey="ebitda" name="EBITDA (R$ mi)" type="number"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  label={{ value: "EBITDA médio (R$ milhões)", fill: "var(--color-muted-foreground)", fontSize: 11, position: "insideBottom", offset: -2 }} />
                <YAxis dataKey="divida" name="Dívida Líquida (R$ mi)" type="number"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                <ZAxis dataKey="empresa" range={[120, 120]} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-[oklch(0.18_0.04_250/0.95)] border border-border/60 rounded-md px-3 py-2 text-xs">
                        <div className="font-semibold">{d.empresa}</div>
                        <div className="text-muted-foreground">{d.setor}</div>
                        <div>EBITDA: R$ {fmtNum(d.ebitda, 0)} mi</div>
                        <div>Dívida Líq.: R$ {fmtNum(d.divida, 0)} mi</div>
                      </div>
                    );
                  }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {bySector.map(([sector, points]) => (
                  <Scatter key={sector} name={sector} data={points} fill={SECTOR_HEX[sector] ?? "#888"} />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Selector({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[];
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground min-w-[200px]">
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}
