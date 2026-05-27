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

// ─── Mensaje al armador ─────────────────────────────────────────────────────

/**
 * Construye el mensaje exacto para enviar al armador por WhatsApp,
 * agrupando items idénticos con xN.
 */
export function buildArmadorMessage(sale: {
  ticket_number: number;
  customer_name: string | null;
  items: SaleItem[];
  total: number;
}): string {
  const lines: string[] = [];
  lines.push(`🔔 *TICKET #${sale.ticket_number}*`);
  if (sale.customer_name && sale.customer_name.trim()) {
    lines.push(`👤 Cliente: ${sale.customer_name.trim()}`);
  }
  lines.push("");
  lines.push("*Armar la siguiente pulsera:*");
  lines.push("");

  for (const item of sale.items) {
    const qty = item.quantity > 1 ? ` x${item.quantity}` : "";
    lines.push(`• ${item.name}${qty}  _(${item.code})_`);
  }

  lines.push("");
  lines.push(`💰 Total cobrado: *${formatCurrency(sale.total)}*`);
  lines.push("");
  lines.push("✅ Cuando termines, entrégala al cliente.");

  return lines.join("\n");
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
