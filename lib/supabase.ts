import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // No tiramos error en build — la usuaria puede compilar sin credenciales
  // y agregarlas en Vercel. En runtime sí explotará si no están.
  if (typeof window !== "undefined") {
    console.warn(
      "⚠️  Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. Configúralas en .env.local."
    );
  }
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder-anon-key"
);

// ─── Tipos del dominio ──────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  display_order: number;
  color: string; // hex, ej "#7C3AED"
  active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  price: number;
  category_id: string | null;
  image_url: string | null;
  active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export type PaymentMethod = "cash" | "transfer" | "card";

export interface PaymentMethodConfig {
  id: string;
  key: string;
  label: string;
  active: boolean;
  display_order: number;
}

export interface SaleItem {
  product_id: string;
  code: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Sale {
  id: string;
  invoice_number: string; // F-YYYY-XXXX
  ticket_number: number;  // secuencial diario
  items: SaleItem[];
  total: number;
  payment_method: PaymentMethod;
  customer_name: string | null;
  customer_phone: string | null;
  identifier_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface Setting {
  key: string;
  value: string;
  updated_at: string;
}

export interface Seller {
  id: string;
  name: string;
  code: string;
  active: boolean;
  created_at: string;
}

// ─── Tipo local solo de cliente ─────────────────────────────────────────────

export interface CartItem extends SaleItem {
  image_url?: string | null;
}

// Fallback estático para mostrar etiquetas (usado en historial de ventas)
export const PAYMENT_LABELS: Record<string, string> = {
  cash:     "Efectivo",
  transfer: "Transferencia",
  card:     "Datafono",
  // compatibilidad con ventas antiguas
  nequi:     "Nequi",
  daviplata: "Daviplata",
};
