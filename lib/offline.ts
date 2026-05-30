import type { Category, Product } from "./supabase";

const CATALOG_KEY = "pelgy_catalog_cache";
const PENDING_KEY = "pelgy_pending_sales";

export interface CatalogCache {
  categories: Category[];
  products: Product[];
  savedAt: number;
}

export interface PendingSale {
  localId: string;
  items: unknown;
  total: number;
  payment_method: string;
  customer_name: string | null;
  customer_phone: string | null;
  identifier_name: string | null;
  createdAt: string;
}

export function saveCatalogCache(
  categories: Category[],
  products: Product[]
): void {
  if (typeof window === "undefined") return;
  const cache: CatalogCache = { categories, products, savedAt: Date.now() };
  localStorage.setItem(CATALOG_KEY, JSON.stringify(cache));
}

export function loadCatalogCache(): CatalogCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    return raw ? (JSON.parse(raw) as CatalogCache) : null;
  } catch {
    return null;
  }
}

export function savePendingSale(sale: Omit<PendingSale, "localId" | "createdAt">): PendingSale {
  const entry: PendingSale = {
    ...sale,
    localId: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  const current = getPendingSales();
  current.push(entry);
  localStorage.setItem(PENDING_KEY, JSON.stringify(current));
  return entry;
}

export function getPendingSales(): PendingSale[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingSale[]) : [];
  } catch {
    return [];
  }
}

export function removePendingSale(localId: string): void {
  const updated = getPendingSales().filter((s) => s.localId !== localId);
  localStorage.setItem(PENDING_KEY, JSON.stringify(updated));
}
