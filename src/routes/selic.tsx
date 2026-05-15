import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ScatterChart, Scatter, ZAxis, ComposedChart,
} from "recharts";
import { useData } from "@/lib/useData";
import { useFilters, inFilters } from "@/lib/filters";
import { SHOCK_HEX, SHOCK_LABEL, fmtNum, fmtPct } from "@/lib/data";
import { PageHeader, Kpi, Panel, Loading, ChartTooltip, ErrorBoundary, NoData, hasData } from "@/components/ui-bits";

export const Route = createFileRoute("/selic")({
  head: () => ({ meta: [
    { title: "Selic vs Alavancagem Corporativa — Brasil em Foco" },
    { name: "description", content: "Como a taxa Selic afetou a alavancagem das empresas brasileiras." },
    { property: "og:title", content: "Selic vs Alavancagem Corporativa" },
    { property: "og:description", content: "Spread ROIC-Selic e Dívida/EBITDA por regime de juros." },
  ]}),
  component: Page,
});

const REGIME_LABEL: Record<string, string> = {
  "Selic_Alta_acima_13pct": "Selic Alta (>13%)",
  "Selic_Mod_8a13pct": "Selic Moderada (8-13%)",
  "Selic_Baixa_4a8pct": "Selic Baixa (4-8%)",
};
const REGIME_ORDER = ["Selic_Baixa_4a8pct", "Selic_Mod_8a13pct", "Selic_Alta_acima_13pct"];

function Page() {
  const data = useData();
  const filters = useFilters();

  const rows = useMemo(() => {
    if (!data) return [];
    try { return data.selic.filter(r => inFilters(r, filters)); } catch (e) { console.error(e); return []; }
  }, [data, filters]);

  // Filter rows for spread/roic charts: drop rows where spread_roic_selic or roic_pct is null
  const validSpreadRows = useMemo(
    () => rows.filter(r => r.spread_roic_selic != null && !isNaN(Number(r.spread_roic_selic))),
    [rows],
  );
  const validRoicRows = useMemo(
    () => rows.filter(r => r.roic_pct != null && !isNaN(Number(r.roic_pct))),
    [rows],
  );

  // KPIs
  const kpis = useMemo(() => {
    try {
      const validDE = rows.filter(r => r.divida_ebitda != null && !isNaN(Number(r.divida_ebitda)));
      const validSelic = rows.filter(r => r.selic_meta_pct != null && !isNaN(Number(r.selic_meta_pct)));
      const avgSpread = validSpreadRows.length ? validSpreadRows.reduce((a, r) => a + Number(r.spread_roic_selic ?? 0), 0) / validSpreadRows.length : 0;
      const avgDE = validDE.length ? validDE.reduce((a, r) => a + Number(r.divida_ebitda ?? 0), 0) / validDE.length : 0;
      const avgSelic = validSelic.length ? validSelic.reduce((a, r) => a + Number(r.selic_meta_pct ?? 0), 0) / validSelic.length : 0;
      return { avgSpread, avgDE, avgSelic };
    } catch (e) { console.error(e); return { avgSpread: 0, avgDE: 0, avgSelic: 0 }; }
  }, [rows, validSpreadRows]);
  const { avgSpread, avgDE, avgSelic } = kpis;

  const series = useMemo(() => {
    try {
      const map = new Map<string, { periodo: string; selic: number; sN: number; de: number; deN: number }>();
      rows.forEach(r => {
        const cur = map.get(r.periodo) ?? { periodo: r.periodo, selic: 0, sN: 0, de: 0, deN: 0 };
        if (r.selic_meta_pct != null) { cur.selic += Number(r.selic_meta_pct); cur.sN += 1; }
        if (r.divida_ebitda != null) { cur.de += Number(r.divida_ebitda); cur.deN += 1; }
        map.set(r.periodo, cur);
      });
      return Array.from(map.values())
        .sort((a, b) => a.periodo.localeCompare(b.periodo))
        .map(v => ({ periodo: v.periodo, selic: v.sN ? v.selic / v.sN : null, de: v.deN ? v.de / v.deN : null }));
    } catch (e) { console.error(e); return []; }
  }, [rows]);

  const scatterByShock = useMemo(() => {
    try {
      const map = new Map<string, { x: number; y: number; empresa: string; periodo: string }[]>();
      rows.forEach(r => {
        if (r.selic_meta_pct == null || r.divida_ebitda == null) return;
        const arr = map.get(r.choque_periodo) ?? [];
        arr.push({ x: Number(r.selic_meta_pct), y: Number(r.divida_ebitda), empresa: r.empresa_nome, periodo: r.periodo });
        map.set(r.choque_periodo, arr);
      });
      return Array.from(map.entries());
    } catch (e) { console.error(e); return []; }
  }, [rows]);

  const spreadByCompany = useMemo(() => {
    try {
      const empresas = Array.from(new Set(validSpreadRows.map(r => r.empresa_nome))).sort();
      return empresas.map(emp => {
        const o: Record<string, string | number> = { empresa: emp.split(" ")[0] };
        REGIME_ORDER.forEach(reg => {
          const subset = validSpreadRows.filter(r => r.empresa_nome === emp && r.regime_selic === reg);
          o[reg] = subset.length ? subset.reduce((a, r) => a + Number(r.spread_roic_selic ?? 0), 0) / subset.length : 0;
        });
        return o;
      });
    } catch (e) { console.error(e); return []; }
  }, [validSpreadRows]);

  const roicVsCost = useMemo(() => {
    try {
      const map = new Map<string, { periodo: string; roic: number; rN: number; custo: number; cN: number }>();
      validRoicRows.forEach(r => {
        const cur = map.get(r.periodo) ?? { periodo: r.periodo, roic: 0, rN: 0, custo: 0, cN: 0 };
        if (r.roic_pct != null && Math.abs(Number(r.roic_pct)) < 200) { cur.roic += Number(r.roic_pct); cur.rN += 1; }
        if (r.custo_implicito_divida_pct != null && Math.abs(Number(r.custo_implicito_divida_pct)) < 200) { cur.custo += Number(r.custo_implicito_divida_pct); cur.cN += 1; }
        map.set(r.periodo, cur);
      });
      return Array.from(map.values())
        .sort((a, b) => a.periodo.localeCompare(b.periodo))
        .map(v => ({ periodo: v.periodo, roic: v.rN ? v.roic / v.rN : null, custo: v.cN ? v.custo / v.cN : null }));
    } catch (e) { console.error(e); return []; }
  }, [validRoicRows]);

  const empresas = useMemo(() => Array.from(new Set(rows.map(r => r.empresa_nome))).sort(), [rows]);
  const shocks = Object.keys(SHOCK_LABEL);
  const heat = useMemo(() => {
    try {
      return empresas.map(emp => ({
        empresa: emp,
        cells: shocks.map(s => {
          const subset = rows.filter(r => r.empresa_nome === emp && r.choque_periodo === s && r.divida_ebitda != null);
          return subset.length ? subset.reduce((a, r) => a + Number(r.divida_ebitda ?? 0), 0) / subset.length : null;
        }),
      }));
    } catch (e) { console.error(e); return []; }
  }, [rows, empresas, shocks]);

  const heatValues = heat.flatMap(r => r.cells.filter((v): v is number => v != null));
  const heatMin = heatValues.length ? Math.min(...heatValues, 0) : 0;
  const heatMax = heatValues.length ? Math.max(...heatValues, 1) : 1;
  const heatColor = (v: number | null) => {
    if (v == null) return "transparent";
    const t = Math.max(0, Math.min(1, (v - heatMin) / (heatMax - heatMin || 1)));
    const r = Math.round(0 + t * 233);
    const g = Math.round(212 - t * 137);
    const b = Math.round(170 - t * 110);
    return `rgb(${r},${g},${b})`;
  };

  if (!data) return <Loading />;

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Página 03"
        title="Selic vs Alavancagem Corporativa"
        subtitle="Como o regime de juros do Banco Central afetou estrutura de capital e geração de valor."
      />

      <div className="px-10 pt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi label="Selic Meta — Média" value={fmtPct(avgSelic)} accent="orange" hint="No período selecionado" />
        <Kpi label="Spread ROIC – Selic — Média" value={fmtPct(avgSpread)} accent={avgSpread >= 0 ? "green" : "red"} hint="ROIC menos Selic, em pontos %" />
        <Kpi label="Dívida / EBITDA — Média" value={fmtNum(avgDE, 2) + "x"} accent="yellow" hint="Alavancagem agregada" />
      </div>

      <div className="px-10 mt-8 space-y-6">
        <Panel title="Selic vs Dívida / EBITDA — Eixos Duplos"
          subtitle="Selic em laranja (esquerda); D/EBITDA em verde (direita).">
          <div className="h-[340px]">
            <ErrorBoundary>
              {hasData(series) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="oklch(0.4 0.04 250 / 0.25)" strokeDasharray="2 4" />
                    <XAxis dataKey="periodo" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} interval={3} />
                    <YAxis yAxisId="L" orientation="left" unit="%" tick={{ fill: "#FF6B35", fontSize: 11 }} />
                    <YAxis yAxisId="R" orientation="right" tick={{ fill: "#00D4AA", fontSize: 11 }} />
                    <Tooltip content={<ChartTooltip formatter={(v, name) => name.includes("Selic") ? fmtPct(v) : fmtNum(v, 2) + "x"} />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line yAxisId="L" type="monotone" dataKey="selic" name="Selic Meta (%)" stroke="#FF6B35" strokeWidth={2.5} dot={false} />
                    <Line yAxisId="R" type="monotone" dataKey="de" name="Dívida / EBITDA (x)" stroke="#00D4AA" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <NoData />}
            </ErrorBoundary>
          </div>
        </Panel>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel title="Selic × Dívida / EBITDA — Por Empresa-Trimestre" subtitle="Cor por choque macroeconômico.">
            <div className="h-[320px]">
              <ErrorBoundary>
                {hasData(scatterByShock) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 16, bottom: 8, left: 0 }}>
                      <CartesianGrid stroke="oklch(0.4 0.04 250 / 0.25)" strokeDasharray="2 4" />
                      <XAxis dataKey="x" name="Selic" type="number" unit="%"
                        tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                      <YAxis dataKey="y" name="D/EBITDA" type="number"
                        tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                      <ZAxis range={[40, 40]} />
                      <Tooltip cursor={{ strokeDasharray: "3 3" }}
                        content={({ active, payload }: any) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-[oklch(0.18_0.04_250/0.95)] border border-border/60 rounded-md px-3 py-2 text-xs">
                              <div className="font-semibold">{d.empresa}</div>
                              <div className="text-muted-foreground">{d.periodo}</div>
                              <div>Selic: {fmtPct(d.x)}</div>
                              <div>D/EBITDA: {fmtNum(d.y, 2)}x</div>
                            </div>
                          );
                        }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      {scatterByShock.map(([sk, pts]) => (
                        <Scatter key={sk} name={SHOCK_LABEL[sk] ?? sk} data={pts} fill={SHOCK_HEX[sk] ?? "#888"} fillOpacity={0.75} />
                      ))}
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : <NoData />}
              </ErrorBoundary>
            </div>
          </Panel>

          <Panel title="Spread ROIC – Selic por Regime de Juros" subtitle="Por empresa, agrupado por regime Selic.">
            <div className="h-[320px]">
              <ErrorBoundary>
                {hasData(spreadByCompany) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={spreadByCompany} margin={{ top: 10, right: 12, bottom: 0, left: -10 }}>
                      <CartesianGrid stroke="oklch(0.4 0.04 250 / 0.25)" strokeDasharray="2 4" />
                      <XAxis dataKey="empresa" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
                      <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                      <Tooltip content={<ChartTooltip formatter={(v) => fmtNum(v, 1)} />} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="Selic_Baixa_4a8pct" name={REGIME_LABEL.Selic_Baixa_4a8pct} fill="#00D4AA" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Selic_Mod_8a13pct" name={REGIME_LABEL.Selic_Mod_8a13pct} fill="#F2C94C" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Selic_Alta_acima_13pct" name={REGIME_LABEL.Selic_Alta_acima_13pct} fill="#E94B3C" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <NoData />}
              </ErrorBoundary>
            </div>
          </Panel>

        </div>

        <Panel title="ROIC vs Custo Implícito da Dívida — Ao Longo do Tempo"
          subtitle="Quando o custo da dívida supera o ROIC, a empresa destrói valor.">
          <div className="h-[320px]">
            <ErrorBoundary>
              {hasData(roicVsCost) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={roicVsCost} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="oklch(0.4 0.04 250 / 0.25)" strokeDasharray="2 4" />
                    <XAxis dataKey="periodo" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} interval={3} />
                    <YAxis unit="%" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                    <Tooltip content={<ChartTooltip formatter={(v) => fmtPct(v)} />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="roic" name="ROIC %" stroke="#00D4AA" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="custo" name="Custo Implícito da Dívida %" stroke="#FF6B35" strokeWidth={2.5} dot={false} strokeDasharray="6 3" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : <NoData />}
            </ErrorBoundary>
          </div>
        </Panel>

        <Panel title="Heatmap: Dívida / EBITDA por Empresa × Choque" subtitle="Verde = baixa alavancagem · Vermelho = alta alavancagem.">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left py-2 px-2 font-medium">Empresa</th>
                  {shocks.map(s => <th key={s} className="text-center px-2 py-2 font-medium">{SHOCK_LABEL[s]}</th>)}
                </tr>
              </thead>
              <tbody>
                {heat.map(r => (
                  <tr key={r.empresa} className="border-t border-border/40">
                    <td className="py-2 px-2 text-foreground">{r.empresa}</td>
                    {r.cells.map((v, i) => (
                      <td key={i} className="text-center py-1 px-2">
                        <div className="rounded px-2 py-1.5 font-mono text-[11px]"
                          style={{ background: heatColor(v), color: v != null && (v - heatMin) / (heatMax - heatMin) > 0.55 ? "#0a1628" : "#fff" }}>
                          {v != null ? fmtNum(v, 2) + "x" : "—"}
                        </div>
                      </td>
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
