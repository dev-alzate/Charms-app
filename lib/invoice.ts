import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Sale } from "./supabase";
import { PAYMENT_LABELS } from "./supabase";
import { formatCurrency, formatDate } from "./format";

const BUSINESS_NAME = process.env.NEXT_PUBLIC_BUSINESS_NAME ?? "Mi Joyería";
const BUSINESS_NIT = process.env.NEXT_PUBLIC_BUSINESS_NIT ?? "";
const BUSINESS_PHONE = process.env.NEXT_PUBLIC_BUSINESS_PHONE ?? "";
const BUSINESS_ADDRESS = process.env.NEXT_PUBLIC_BUSINESS_ADDRESS ?? "";

/**
 * Genera y descarga la factura en formato 80mm (recibo térmico).
 * 80mm ≈ 226pt de ancho. Largo se ajusta automáticamente con el contenido.
 */
export function downloadInvoice(sale: Sale): void {
  // Ancho fijo 80mm, alto generoso (el contenido se trunca o se queda con espacio)
  const doc = new jsPDF({
    unit: "mm",
    format: [80, 297], // 80mm de ancho, alto A4 (se puede recortar al final)
    orientation: "portrait",
  });

  const margin = 4;
  let y = 6;
  const pageWidth = 80;
  const contentWidth = pageWidth - margin * 2;

  // ─── Encabezado ───────────────────────────────────────────────────────
  doc.setTextColor(168, 126, 90); // brand cobrizo PELGY
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  // Spacing entre letras para look editorial
  doc.text(BUSINESS_NAME.split("").join(" "), pageWidth / 2, y + 2, {
    align: "center",
  });
  y += 7;

  doc.setTextColor(61, 40, 23); // ink
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  if (BUSINESS_NIT) {
    doc.text(`NIT ${BUSINESS_NIT}`, pageWidth / 2, y, { align: "center" });
    y += 3.5;
  }
  if (BUSINESS_PHONE) {
    doc.text(BUSINESS_PHONE, pageWidth / 2, y, { align: "center" });
    y += 3.5;
  }
  if (BUSINESS_ADDRESS) {
    doc.text(BUSINESS_ADDRESS, pageWidth / 2, y, { align: "center" });
    y += 3.5;
  }

  y += 2;
  doc.setLineDashPattern([0.5, 0.5], 0);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // ─── Datos de la factura ──────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(`Factura: ${sale.invoice_number}`, margin, y);
  y += 3.5;
  doc.setFont("helvetica", "normal");
  doc.text(`Ticket: #${sale.ticket_number}`, margin, y);
  y += 3.5;
  doc.text(formatDate(sale.created_at), margin, y);
  y += 3.5;
  if (sale.identifier_name) {
    doc.text(`Atendió: ${sale.identifier_name}`, margin, y);
    y += 3.5;
  }
  if (sale.customer_name) {
    doc.text(`Cliente: ${sale.customer_name}`, margin, y);
    y += 3.5;
  }

  y += 1;
  doc.line(margin, y, pageWidth - margin, y);
  y += 3;

  // ─── Tabla de items ───────────────────────────────────────────────────
  const rows = sale.items.map((it) => [
    `${it.name}\n${it.code}`,
    String(it.quantity),
    formatCurrency(it.price * it.quantity),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Producto", "Cant", "Subtotal"]],
    body: rows,
    theme: "plain",
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    styles: {
      fontSize: 7.5,
      cellPadding: 1.2,
      overflow: "linebreak",
      textColor: [61, 40, 23], // ink
    },
    headStyles: {
      fontStyle: "bold",
      fillColor: [248, 241, 229], // cream-100
      textColor: [79, 58, 38], // brand-darker
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: contentWidth - 26 },
      1: { cellWidth: 10, halign: "center" },
      2: { cellWidth: 16, halign: "right" },
    },
  });

  // @ts-expect-error — autoTable agrega esto al doc en runtime
  y = doc.lastAutoTable.finalY + 3;

  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // ─── Total ────────────────────────────────────────────────────────────
  doc.setTextColor(79, 58, 38); // brand-darker
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL", margin, y);
  doc.text(formatCurrency(sale.total), pageWidth - margin, y, { align: "right" });
  doc.setTextColor(61, 40, 23); // ink
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Pago: ${PAYMENT_LABELS[sale.payment_method]}`, margin, y);
  y += 5;

  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // ─── Pie ──────────────────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(168, 126, 90);
  doc.text("Gracias por tu compra", pageWidth / 2, y, { align: "center" });
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(139, 115, 85); // ink-muted
  doc.text("Joyería de charms personalizados", pageWidth / 2, y, {
    align: "center",
  });

  doc.save(`Factura-${sale.invoice_number}.pdf`);
}
