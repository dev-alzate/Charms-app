"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartItem,
  Category,
  PAYMENT_LABELS,
  PaymentMethod,
  Product,
  Sale,
  supabase,
} from "@/lib/supabase";
import {
  buildArmadorMessage,
  buildCustomerMessage,
  buildWhatsAppLink,
  formatCurrency,
} from "@/lib/format";
import { downloadInvoice } from "@/lib/invoice";

const BUSINESS_NAME = process.env.NEXT_PUBLIC_BUSINESS_NAME ?? "Mi Joyería";
const LS_IDENTIFIER = "charms_identifier_name";

type View = "grid" | "checkout" | "success";

export default function SalePage() {
  // ── Identificación del vendedor ─────────────────────────────────────────
  const [identifier, setIdentifier] = useState("");
  const [identifierInput, setIdentifierInput] = useState("");
  const [identifierReady, setIdentifierReady] = useState(false);

  // ── Catálogo ────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [armadorPhone, setArmadorPhone] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // ── Estado del flujo de venta ───────────────────────────────────────────
  const [activeCategoryId, setActiveCategoryId] = useState<string | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [view, setView] = useState<View>("grid");
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // ── Inicialización: nombre del vendedor desde localStorage ─────────────
  useEffect(() => {
    const stored = typeof window !== "undefined"
      ? window.localStorage.getItem(LS_IDENTIFIER)
      : null;
    if (stored && stored.trim()) {
      setIdentifier(stored.trim());
      setIdentifierReady(true);
    }
  }, []);

  // ── Carga del catálogo + settings ──────────────────────────────────────
  useEffect(() => {
    if (!identifierReady) return;
    let cancelled = false;

    (async () => {
      setLoadingCatalog(true);
      setLoadError(null);
      try {
        const [catRes, prodRes, settingsRes] = await Promise.all([
          supabase
            .from("categories")
            .select("*")
            .eq("active", true)
            .order("display_order", { ascending: true }),
          supabase
            .from("products")
            .select("*")
            .eq("active", true)
            .order("display_order", { ascending: true }),
          supabase
            .from("settings")
            .select("*")
            .eq("key", "armador_whatsapp")
            .maybeSingle(),
        ]);

        if (catRes.error) throw catRes.error;
        if (prodRes.error) throw prodRes.error;
        if (settingsRes.error) throw settingsRes.error;

        if (cancelled) return;
        setCategories((catRes.data ?? []) as Category[]);
        setProducts((prodRes.data ?? []) as Product[]);
        setArmadorPhone(settingsRes.data?.value ?? "");
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Error cargando datos";
        setLoadError(msg);
      } finally {
        if (!cancelled) setLoadingCatalog(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [identifierReady]);

  // ── Productos visibles según tab + búsqueda ─────────────────────────────
  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory =
        q.length > 0 || activeCategoryId === "ALL"
          ? true
          : p.category_id === activeCategoryId;
      const matchesSearch = q
        ? p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
        : true;
      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategoryId, search]);

  // ── Totales del carrito ─────────────────────────────────────────────────
  const cartTotal = useMemo(
    () => cart.reduce((sum, it) => sum + it.price * it.quantity, 0),
    [cart]
  );
  const cartCount = useMemo(
    () => cart.reduce((n, it) => n + it.quantity, 0),
    [cart]
  );

  // ── Handlers de carrito ─────────────────────────────────────────────────
  const addToCart = useCallback((p: Product) => {
    setCart((prev) => {
      const idx = prev.findIndex((it) => it.product_id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          product_id: p.id,
          code: p.code,
          name: p.name,
          price: Number(p.price),
          quantity: 1,
        },
      ];
    });
  }, []);

  const changeQty = useCallback((productId: string, delta: number) => {
    setCart((prev) => {
      const next: CartItem[] = [];
      for (const it of prev) {
        if (it.product_id !== productId) {
          next.push(it);
          continue;
        }
        const newQty = it.quantity + delta;
        if (newQty <= 0) continue;
        next.push({ ...it, quantity: newQty });
      }
      return next;
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((it) => it.product_id !== productId));
  }, []);

  const resetForNextCustomer = useCallback(() => {
    setCart([]);
    setPayment(null);
    setCustomerName("");
    setCustomerPhone("");
    setCompletedSale(null);
    setSubmitError(null);
    setSearch("");
    setActiveCategoryId("ALL");
    setView("grid");
  }, []);

  // ── Confirmar pago: INSERT en sales ─────────────────────────────────────
  const confirmPayment = useCallback(async () => {
    if (!payment) return;
    if (cart.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const { data, error } = await supabase
        .from("sales")
        .insert({
          items: cart,
          total: cartTotal,
          payment_method: payment,
          customer_name: customerName.trim() || null,
          customer_phone: customerPhone.trim() || null,
          identifier_name: identifier || null,
        })
        .select()
        .single();

      if (error) throw error;
      setCompletedSale(data as Sale);
      setView("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo guardar la venta";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [payment, cart, cartTotal, customerName, customerPhone, identifier]);

  // ── Acciones post-venta ─────────────────────────────────────────────────
  const openArmadorWhatsApp = useCallback(() => {
    if (!completedSale) return;
    if (!armadorPhone) {
      alert(
        "No hay número del armador configurado. Ve a /admin → Configuración."
      );
      return;
    }
    const msg = buildArmadorMessage(completedSale);
    window.open(buildWhatsAppLink(armadorPhone, msg), "_blank");
  }, [completedSale, armadorPhone]);

  const openCustomerWhatsApp = useCallback(() => {
    if (!completedSale) return;
    if (!completedSale.customer_phone) {
      alert("No registraste el celular del cliente en la venta.");
      return;
    }
    const msg = buildCustomerMessage(completedSale, BUSINESS_NAME);
    window.open(
      buildWhatsAppLink(completedSale.customer_phone, msg),
      "_blank"
    );
  }, [completedSale]);

  const handleDownloadPDF = useCallback(() => {
    if (!completedSale) return;
    downloadInvoice(completedSale);
  }, [completedSale]);

  // ── Submit del modal de identificación ──────────────────────────────────
  const submitIdentifier = useCallback(() => {
    const name = identifierInput.trim();
    if (!name) return;
    window.localStorage.setItem(LS_IDENTIFIER, name);
    setIdentifier(name);
    setIdentifierReady(true);
  }, [identifierInput]);

  const changeIdentifier = useCallback(() => {
    setIdentifierInput(identifier);
    setIdentifier("");
    setIdentifierReady(false);
    window.localStorage.removeItem(LS_IDENTIFIER);
  }, [identifier]);

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  // Modal de identificación bloqueante
  if (!identifierReady) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-neutral-50">
        <div className="card p-6 w-full max-w-md">
          <h1 className="text-2xl font-bold mb-2">¿Quién está vendiendo?</h1>
          <p className="text-sm text-neutral-500 mb-4">
            Escribe tu nombre. Quedará registrado en cada venta de este turno.
          </p>
          <input
            className="input mb-4"
            type="text"
            placeholder="Ej: María"
            value={identifierInput}
            onChange={(e) => setIdentifierInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitIdentifier();
            }}
            autoFocus
          />
          <button
            className="btn-primary w-full"
            onClick={submitIdentifier}
            disabled={!identifierInput.trim()}
          >
            Continuar
          </button>
          <Link
            href="/"
            className="block text-center text-sm text-neutral-500 mt-4"
          >
            ← Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  if (loadingCatalog) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-500">Cargando catálogo...</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-6 max-w-md">
          <h2 className="text-xl font-bold mb-2 text-red-600">
            Error al cargar
          </h2>
          <p className="text-sm text-neutral-600 mb-4 break-words">
            {loadError}
          </p>
          <p className="text-xs text-neutral-500 mb-4">
            Verifica las variables de entorno de Supabase y que el script
            <code className="bg-neutral-100 px-1 rounded mx-1">
              supabase/schema.sql
            </code>
            se haya ejecutado.
          </p>
          <Link href="/" className="btn-secondary block text-center">
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  // ─── Vista: éxito de venta ─────────────────────────────────────────────
  if (view === "success" && completedSale) {
    return (
      <main className="min-h-screen p-4 bg-gradient-to-b from-green-50 to-neutral-50">
        <div className="max-w-md mx-auto pt-6">
          <div className="text-center mb-6">
            <div className="text-7xl mb-2">✅</div>
            <h1 className="text-2xl font-bold">¡Venta registrada!</h1>
            <p className="text-neutral-500 mt-1">
              Factura{" "}
              <span className="font-mono font-semibold">
                {completedSale.invoice_number}
              </span>
            </p>
            <p className="text-neutral-500">
              Ticket{" "}
              <span className="font-mono font-semibold">
                #{completedSale.ticket_number}
              </span>
            </p>
          </div>

          <div className="card p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-neutral-500">Total</span>
              <span className="text-2xl font-bold">
                {formatCurrency(completedSale.total)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-neutral-500">Pago</span>
              <span>{PAYMENT_LABELS[completedSale.payment_method]}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 mb-6">
            <button className="btn-primary py-5 text-lg" onClick={openArmadorWhatsApp}>
              📤 Enviar al armador
            </button>
            <button className="btn-secondary py-4" onClick={handleDownloadPDF}>
              📄 Descargar PDF
            </button>
            <button
              className="btn-secondary py-4"
              onClick={openCustomerWhatsApp}
              disabled={!completedSale.customer_phone}
              title={
                completedSale.customer_phone
                  ? "Enviar factura al cliente"
                  : "Solo disponible si registraste el celular del cliente"
              }
            >
              💬 Enviar factura al cliente
            </button>
          </div>

          <button
            className="btn-primary w-full py-6 text-xl bg-green-600 hover:bg-green-700"
            onClick={resetForNextCustomer}
          >
            ➡️ Siguiente cliente
          </button>
        </div>
      </main>
    );
  }

  // ─── Vista: checkout ───────────────────────────────────────────────────
  if (view === "checkout") {
    return (
      <main className="min-h-screen p-4 bg-neutral-50">
        <div className="max-w-md mx-auto">
          <button
            className="text-brand mb-3 font-medium"
            onClick={() => setView("grid")}
            disabled={submitting}
          >
            ← Volver
          </button>

          <h1 className="text-2xl font-bold mb-1">Cobrar</h1>
          <p className="text-neutral-500 mb-4">
            {cartCount} pieza{cartCount === 1 ? "" : "s"} —{" "}
            <span className="font-semibold">{formatCurrency(cartTotal)}</span>
          </p>

          <div className="card p-4 mb-4">
            <h2 className="font-semibold mb-3">Método de pago</h2>
            <div className="grid grid-cols-1 gap-2">
              {(["cash", "nequi", "daviplata"] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  className={`btn-touch py-5 text-lg border-2 ${
                    payment === m
                      ? "bg-brand text-white border-brand"
                      : "bg-white text-neutral-900 border-neutral-300"
                  }`}
                  onClick={() => setPayment(m)}
                >
                  {m === "cash" && "💵 "}
                  {m === "nequi" && "📱 "}
                  {m === "daviplata" && "💳 "}
                  {PAYMENT_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-4 mb-4">
            <h2 className="font-semibold mb-3">
              Datos del cliente{" "}
              <span className="text-sm font-normal text-neutral-500">
                (opcional)
              </span>
            </h2>
            <input
              className="input mb-3"
              type="text"
              placeholder="Nombre"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <input
              className="input"
              type="tel"
              inputMode="numeric"
              placeholder="Celular (para enviar factura por WhatsApp)"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>

          {submitError && (
            <div className="card p-3 mb-4 border-red-200 bg-red-50 text-red-700 text-sm">
              {submitError}
            </div>
          )}

          <button
            className="btn-primary w-full py-6 text-xl bg-green-600 hover:bg-green-700"
            onClick={confirmPayment}
            disabled={!payment || submitting}
          >
            {submitting ? "Guardando..." : `✅ Confirmar ${formatCurrency(cartTotal)}`}
          </button>
        </div>
      </main>
    );
  }

  // ─── Vista: grid (default) ─────────────────────────────────────────────
  return (
    <main className="min-h-screen pb-32 bg-neutral-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-neutral-200">
        <div className="px-3 py-2 flex items-center gap-2">
          <Link href="/" className="text-neutral-500 text-sm px-2">
            ←
          </Link>
          <button
            onClick={changeIdentifier}
            className="text-sm font-medium flex-1 text-left truncate"
            title="Cambiar de vendedor"
          >
            👤 {identifier}
          </button>
          <span className="text-xs text-neutral-400">
            {cartCount} en carrito
          </span>
        </div>
        <div className="px-3 pb-2">
          <input
            className="input"
            type="search"
            placeholder="🔎 Buscar por nombre o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Tabs categorías */}
        <div className="overflow-x-auto scroll-x-hidden border-t border-neutral-100">
          <div className="flex gap-2 px-3 py-2 min-w-max">
            <CategoryTab
              label="Todos"
              color="#525252"
              active={activeCategoryId === "ALL"}
              onClick={() => setActiveCategoryId("ALL")}
            />
            {categories.map((c) => (
              <CategoryTab
                key={c.id}
                label={c.name}
                color={c.color}
                active={activeCategoryId === c.id}
                onClick={() => setActiveCategoryId(c.id)}
              />
            ))}
          </div>
        </div>
      </header>

      {/* Grid productos */}
      <section className="p-3">
        {visibleProducts.length === 0 ? (
          <p className="text-center text-neutral-500 py-12">
            {search
              ? "No hay productos que coincidan con tu búsqueda."
              : "Esta categoría no tiene productos todavía."}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {visibleProducts.map((p) => (
              <button
                key={p.id}
                className="card p-3 text-left active:scale-[0.97] transition-transform"
                onClick={() => addToCart(p)}
              >
                <div className="text-3xl mb-1">💎</div>
                <div className="font-semibold text-sm leading-tight line-clamp-2">
                  {p.name}
                </div>
                <div className="text-xs text-neutral-400 mt-1">{p.code}</div>
                <div className="text-brand font-bold mt-1">
                  {formatCurrency(Number(p.price))}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Carrito flotante */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-neutral-200 shadow-lg">
          <div className="max-w-3xl mx-auto p-3">
            <details className="mb-2">
              <summary className="cursor-pointer text-sm text-neutral-600 mb-2">
                Ver detalle del carrito ({cartCount}{" "}
                {cartCount === 1 ? "pieza" : "piezas"})
              </summary>
              <ul className="max-h-48 overflow-y-auto mb-2 divide-y divide-neutral-100">
                {cart.map((it) => (
                  <li
                    key={it.product_id}
                    className="flex items-center gap-2 py-2 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{it.name}</div>
                      <div className="text-xs text-neutral-400">
                        {it.code} · {formatCurrency(it.price)}
                      </div>
                    </div>
                    <button
                      className="w-9 h-9 rounded-full bg-neutral-100 font-bold"
                      onClick={() => changeQty(it.product_id, -1)}
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-semibold">
                      {it.quantity}
                    </span>
                    <button
                      className="w-9 h-9 rounded-full bg-neutral-100 font-bold"
                      onClick={() => changeQty(it.product_id, +1)}
                    >
                      +
                    </button>
                    <button
                      className="text-red-500 px-2"
                      onClick={() => removeFromCart(it.product_id)}
                      title="Quitar"
                    >
                      🗑
                    </button>
                  </li>
                ))}
              </ul>
            </details>
            <button
              className="btn-primary w-full py-5 text-lg flex items-center justify-between px-5 bg-green-600 hover:bg-green-700"
              onClick={() => setView("checkout")}
            >
              <span>Cobrar</span>
              <span>{formatCurrency(cartTotal)}</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Subcomponente: tab de categoría ──────────────────────────────────────

function CategoryTab({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`btn-touch px-4 py-2 text-sm whitespace-nowrap border-2 ${
        active ? "text-white" : "text-neutral-700 bg-white"
      }`}
      style={
        active
          ? { backgroundColor: color, borderColor: color }
          : { borderColor: color }
      }
    >
      {label}
    </button>
  );
}
