import type { Sale, SaleItem } from "./supabase";
import { PAYMENT_LABELS } from "./supabase";

// ─── Formato moneda (COP) ───────────────────────────────────────────────────

const currencyFmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  return currencyFmt.format(amount);
}

// ─── Formato fecha ──────────────────────────────────────────────────────────

const dateFmt = new Intl.DateTimeFormat("es-CO", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(iso: string): string {
  try {
    return dateFmt.format(new Date(iso));
  } catch {
    return iso;
  }
}

// ─── WhatsApp helpers ───────────────────────────────────────────────────────

/**
 * Normaliza un número a formato wa.me (solo dígitos, sin +).
 * Si no incluye código de país, asume Colombia (57).
 */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  // Si ya empieza por 57 y tiene >=12 dígitos, asumimos código incluido
  if (digits.startsWith("57") && digits.length >= 12) return digits;
  // Si parece celular colombiano (10 dígitos comenzando por 3), prepende 57
  if (digits.length === 10 && digits.startsWith("3")) return "57" + digits;
  return digits;
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const normalized = normalizePhone(phone);
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${normalized}?text=${encoded}`;
}

// ─── Mensaje al cliente (resumen de factura) ────────────────────────────────

export function buildCustomerMessage(sale: Sale, businessName: string): string {
  const lines: string[] = [];
  lines.push(`¡Gracias por tu compra en *${businessName}*! 💎`);
  lines.push("");
  lines.push(`Factura: *${sale.invoice_number}*`);
  lines.push(`Total: *${formatCurrency(sale.total)}*`);
  lines.push(`Pago: ${PAYMENT_LABELS[sale.payment_method]}`);
  lines.push("");
  lines.push("Tu pulsera estará lista en unos minutos. 🙌");
  return lines.join("\n");
}
