import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ComposedChart, Legend,
} from "recharts";
import { useData } from "@/lib/useData";
import { useFilters } from "@/lib/filters";
import { SHOCK_HEX, SHOCK_LABEL, fmtNum, fmtPct } from "@/lib/data";
import { PageHeader, Kpi, Panel, Loading, ChartTooltip } from "@/components/ui-bits";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Macroeconomia 2014–2024 — Brasil em Foco" },
    { name: "description", content: "Trajetória do desemprego, PIB e salário mínimo real do Brasil entre 2014 e 2024." },
    { property: "og:title", content: "Trajetória Macroeconômica do Brasil — 2014 a 2024" },
    { property: "og:description", content: "Os três choques que moldaram a década: recessão, pandemia e espiral inflacionária." },
  ]}),
  component: Page,
});

const SHOCK_BANDS = [
  { from: "2015-01", to: "2016-12", key: "Recessao_2015_16" },
  { from: "2020-01", to: "2020-12", key: "Pandemia_2020" },
  { from: "2021-06", to: "2022-12", key: "Espiral_Inflacionaria_21_22" },
];

function Page() {
  const data = useData();
  const { yearRange } = useFilters();

  const macro = useMemo(() => {
    if (!data) return [];
    return data.macro
      .filter(r => r.Year >= yearRange[0] && r.Year <= yearRange[1])
      .map(r => ({ ...r }));
  }, [data, yearRange]);

  if (!data) return <Loading />;

  const first = macro[0];
  const last = macro[macro.length - 1];
  const pctChange = (a: number, b: number) => ((b - a) / a) * 100;

  const annualGdp = Array.from(
    macro.reduce((m, r) => {
      if (!m.has(r.Year)) m.set(r.Year, r.GDP_USD);
      return m;
    }, new Map<number, number>()),
  ).map(([year, gdp]) => ({ year, gdp }));

  // GDP trend (simple linear regression)
  const xs = annualGdp.map((_, i) => i);
  const ys = annualGdp.map(d => d.gdp);
  const n = xs.length || 1;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, b, i) => a + b * ys[i], 0);
  const sumX2 = xs.reduce((a, b) => a + b * b, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
  const intercept = (sumY - slope * sumX) / n;
  const annualGdpWithTrend = annualGdp.map((d, i) => ({ ...d, trend: intercept + slope * i }));

  const formatMoney = (n: number) => `US$ ${(n / 1000).toFixed(1)} mil`;

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Página 01"
        title="Trajetória Macroeconômica (2014–2024)"
        subtitle="Uma década definida por três choques sucessivos: a recessão de 2015-16, a pandemia de 2020 e a espiral inflacionária de 2021-22."
      />

      <div className="px-10 pt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi
          label="Desemprego"
          value={fmtPct(last?.Unemployment_Rate)}
          delta={`${pctChange(first.Unemployment_Rate, last.Unemployment_Rate) >= 0 ? "▲" : "▼"} ${fmtNum(Math.abs(pctChange(first.Unemployment_Rate, last.Unemployment_Rate)), 1)}% vs ${first?.Year}`}
          hint={`${first?.Year}: ${fmtPct(first?.Unemployment_Rate)}  →  ${last?.Year}: ${fmtPct(last?.Unemployment_Rate)}`}
          accent={last.Unemployment_Rate < first.Unemployment_Rate ? "green" : "red"}
        />
        <Kpi
          label="PIB (US$ bilhões)"
          value={fmtNum(last?.GDP_USD, 0)}
          delta={`${pctChange(first.GDP_USD, last.GDP_USD) >= 0 ? "▲" : "▼"} ${fmtNum(Math.abs(pctChange(first.GDP_USD, last.GDP_USD)), 1)}% vs ${first?.Year}`}
          hint={`${first?.Year}: US$ ${fmtNum(first?.GDP_USD, 0)} bi  →  ${last?.Year}: US$ ${fmtNum(last?.GDP_USD, 0)} bi`}
          accent={last.GDP_USD >= first.GDP_USD ? "green" : "red"}
        />
        <Kpi
          label="Salário Mínimo Real (R$)"
          value={`R$ ${fmtNum(last?.Real_Min_Wage_BRL, 0)}`}
          delta={`${pctChange(first.Real_Min_Wage_BRL, last.Real_Min_Wage_BRL) >= 0 ? "▲" : "▼"} ${fmtNum(Math.abs(pctChange(first.Real_Min_Wage_BRL, last.Real_Min_Wage_BRL)), 1)}% vs ${first?.Year}`}
          hint={`${first?.Year}: R$ ${fmtNum(first?.Real_Min_Wage_BRL, 0)}  →  ${last?.Year}: R$ ${fmtNum(last?.Real_Min_Wage_BRL, 0)}`}
          accent={last.Real_Min_Wage_BRL >= first.Real_Min_Wage_BRL ? "green" : "red"}
        />
      </div>

      <div className="px-10 mt-8 space-y-6">
        <Panel
          title="Taxa de Desemprego Mensal — colorida por choque"
          subtitle="Bandas verticais marcam os três grandes choques da década."
        >
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={macro} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
                <CartesianGrid stroke="oklch(0.4 0.04 250 / 0.25)" strokeDasharray="2 4" />
                <XAxis dataKey="Date" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} interval={11} />
                <YAxis unit="%" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                {SHOCK_BANDS.map((b) => (
                  <ReferenceArea key={b.key} x1={b.from} x2={b.to}
                    fill={SHOCK_HEX[b.key]} fillOpacity={0.08}
                    stroke={SHOCK_HEX[b.key]} strokeOpacity={0.4} strokeDasharray="3 3"
                    label={{ value: SHOCK_LABEL[b.key], position: "insideTop", fill: SHOCK_HEX[b.key], fontSize: 10 }}
                  />
                ))}
                <Tooltip content={<ChartTooltip formatter={(v) => `${fmtNum(v, 1)}%`} />} />
                <Line type="monotone" dataKey="Unemployment_Rate" name="Desemprego" stroke="#FF6B35" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-[11px] text-muted-foreground">
            {Object.entries(SHOCK_LABEL).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: SHOCK_HEX[k] }} />{v}
              </span>
            ))}
          </div>
        </Panel>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel title="PIB Anual (US$ bilhões) — com tendência" subtitle="Barras anuais e linha de tendência linear.">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={annualGdpWithTrend} margin={{ top: 10, right: 12, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="oklch(0.4 0.04 250 / 0.25)" strokeDasharray="2 4" />
                  <XAxis dataKey="year" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} />
                  <Tooltip content={<ChartTooltip formatter={(v) => formatMoney(v)} />} />
                  <Bar dataKey="gdp" name="PIB" fill="#00D4AA" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="trend" name="Tendência" stroke="#FF6B35" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Salário Mínimo Real (R$) — Evolução" subtitle="Em reais constantes — preserva poder de compra.">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={macro} margin={{ top: 10, right: 12, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="oklch(0.4 0.04 250 / 0.25)" strokeDasharray="2 4" />
                  <XAxis dataKey="Date" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} interval={11} />
                  <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} domain={["auto", "auto"]} />
                  {SHOCK_BANDS.map((b) => (
                    <ReferenceLine key={b.key} x={b.from} stroke={SHOCK_HEX[b.key]} strokeDasharray="3 3" />
                  ))}
                  <Tooltip content={<ChartTooltip formatter={(v) => `R$ ${fmtNum(v, 0)}`} />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="Real_Min_Wage_BRL" name="Salário mínimo real" stroke="#00D4AA" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
