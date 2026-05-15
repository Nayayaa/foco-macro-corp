import { createContext, useContext, useState, type ReactNode } from "react";

export type FilterState = {
  yearRange: [number, number];
  shock: string; // "ALL" or one of shocks
  setYearRange: (r: [number, number]) => void;
  setShock: (s: string) => void;
};

const FilterCtx = createContext<FilterState | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [yearRange, setYearRange] = useState<[number, number]>([2014, 2024]);
  const [shock, setShock] = useState("ALL");
  return (
    <FilterCtx.Provider value={{ yearRange, shock, setYearRange, setShock }}>
      {children}
    </FilterCtx.Provider>
  );
}

export function useFilters() {
  const ctx = useContext(FilterCtx);
  if (!ctx) throw new Error("useFilters outside provider");
  return ctx;
}

export function inFilters<T extends { ano?: number; Year?: number; choque_periodo?: string }>(
  row: T, f: { yearRange: [number, number]; shock: string }
) {
  const y = row.ano ?? row.Year;
  if (y == null) return true;
  if (y < f.yearRange[0] || y > f.yearRange[1]) return false;
  if (f.shock !== "ALL" && row.choque_periodo !== f.shock) return false;
  return true;
}
