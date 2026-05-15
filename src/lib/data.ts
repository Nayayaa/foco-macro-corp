import Papa from "papaparse";

export type MacroRow = {
  Date: string; Year: number; Month: number;
  Unemployment_Rate: number; Real_Min_Wage_BRL: number; GDP_USD: number;
  choque_periodo?: string;
};
export type FinRow = {
  empresa_key: string; empresa_nome: string; ticker_b3: string; setor: string;
  data_referencia: string; ano: number; trimestre: number; periodo: string;
  receita_liquida: number | null; ebitda: number | null; ebit: number | null;
  lucro_liquido: number | null; divida_total: number | null; divida_liquida: number | null;
  divida_ebitda: number | null; margem_ebitda_pct: number | null; margem_liquida_pct: number | null;
  roe_pct: number | null; roa_pct: number | null;
  selic_meta_pct: number | null; choque_periodo: string;
};
export type SelicRow = {
  empresa_key: string; empresa_nome: string; setor: string;
  data_referencia: string; ano: number; trimestre: number; periodo: string;
  divida_ebitda: number | null; roic_pct: number | null; roe_pct: number | null;
  spread_roic_selic: number | null; custo_implicito_divida_pct: number | null;
  selic_meta_pct: number | null; regime_selic: string; choque_periodo: string;
};
export type MercadoRow = {
  empresa_key: string; empresa_nome: string; setor: string;
  data_referencia: string; ano: number; mes: number;
  preco_fechamento: number | null; volume_medio: number | null;
  market_cap_bi: number | null; pl_ratio: number | null; ev_ebitda: number | null;
  cambio_brl_usd: number | null; choque_periodo: string;
};

const SHOCK_BY_DATE = (date: string): string => {
  const y = parseInt(date.slice(0, 4));
  const m = parseInt(date.slice(5, 7));
  if ((y === 2015) || (y === 2016)) return "Recessao_2015_16";
  if (y === 2020) return "Pandemia_2020";
  if ((y === 2021 && m >= 6) || (y === 2022)) return "Espiral_Inflacionaria_21_22";
  return "Periodo_Normal";
};

async function fetchCsv<T = Record<string, unknown>>(url: string): Promise<T[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Failed to fetch ${url}: ${res.status}`);
      return [];
    }
    const text = await res.text();
    const parsed = Papa.parse<T>(text.replace(/^\uFEFF/, ""), {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      transform: (value) => {
        // Empty strings → null so they never get parsed as 0 or NaN downstream
        if (value === "" || value === "indisponivel" || value === "NA" || value === "N/A") return null as unknown as string;
        return value;
      },
    });
    if (parsed.errors?.length) console.warn(`CSV parse warnings for ${url}:`, parsed.errors.slice(0, 3));
    return (parsed.data as T[]).filter(Boolean);
  } catch (e) {
    console.error(`Error loading ${url}:`, e);
    return [];
  }
}

let cache: {
  macro?: MacroRow[]; fin?: FinRow[]; selic?: SelicRow[]; mercado?: MercadoRow[];
} = {};

export async function loadAll() {
  if (cache.macro && cache.fin && cache.selic && cache.mercado) return cache as Required<typeof cache>;
  try {
    const [macro, fin, selic, mercado] = await Promise.all([
      fetchCsv<MacroRow>("/data/macro.csv"),
      fetchCsv<FinRow>("/data/financeiro.csv"),
      fetchCsv<SelicRow>("/data/selic.csv"),
      fetchCsv<MercadoRow>("/data/mercado.csv"),
    ]);
    macro.forEach(r => { try { if (r?.Date) r.choque_periodo = SHOCK_BY_DATE(r.Date); } catch { /* ignore */ } });
    cache = { macro, fin, selic, mercado };
    return cache as Required<typeof cache>;
  } catch (e) {
    console.error("loadAll failed:", e);
    cache = { macro: [], fin: [], selic: [], mercado: [] };
    return cache as Required<typeof cache>;
  }
}

export const SHOCK_LABEL: Record<string, string> = {
  Periodo_Normal: "Período Normal",
  Recessao_2015_16: "Recessão 2015-16",
  Pandemia_2020: "Pandemia 2020",
  Espiral_Inflacionaria_21_22: "Espiral Inflacionária 2021-22",
};
export const SHOCK_COLOR: Record<string, string> = {
  Periodo_Normal: "var(--green)",
  Recessao_2015_16: "var(--red)",
  Pandemia_2020: "var(--orange)",
  Espiral_Inflacionaria_21_22: "var(--yellow)",
};
export const SHOCK_HEX: Record<string, string> = {
  Periodo_Normal: "#00D4AA",
  Recessao_2015_16: "#E94B3C",
  Pandemia_2020: "#FF6B35",
  Espiral_Inflacionaria_21_22: "#F2C94C",
};

export const SECTOR_HEX: Record<string, string> = {
  "Bebidas": "#FF6B35",
  "Financeiro": "#00D4AA",
  "Aviação": "#F2C94C",
  "Alimentos": "#9B5DE5",
  "Mineração": "#E94B3C",
  "Varejo": "#56CCF2",
  "Óleo e Gás": "#F2994A",
  "Indústria": "#6FCF97",
};

export const fmtBRL = (n: number | null | undefined, digits = 0) =>
  n == null || isNaN(n) ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: digits }).format(n);
export const fmtNum = (n: number | null | undefined, digits = 1) =>
  n == null || isNaN(n) ? "—" : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
export const fmtPct = (n: number | null | undefined, digits = 1) =>
  n == null || isNaN(n) ? "—" : `${fmtNum(n, digits)}%`;
