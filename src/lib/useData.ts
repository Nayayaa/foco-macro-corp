import { useEffect, useState } from "react";
import { loadAll } from "./data";

type Loaded = Awaited<ReturnType<typeof loadAll>>;

export function useData() {
  const [data, setData] = useState<Loaded | null>(null);
  useEffect(() => { loadAll().then(setData); }, []);
  return data;
}
