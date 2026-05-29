"use client";

import Image from "next/image";
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
import {
  getPendingSales,
  loadCatalogCache,
  removePendingSale,
  saveCatalogCache,
  savePendingSale,
} from "@/lib/offline";

const BUSINESS_NAME = process.env.NEXT_PUBLIC_BUSINESS_NAME ?? "PELGY";
const LS_IDENTIFIER = "charms_identifier_name";

type View = "grid" | "checkout" | "success";

export default function SalePage() {
  // ── Identificación del vendedor ─────────────────────────────────────────
  const [identifier, setIdentifier] = useState("");
  const [identifierInput, setIdentifierInput] = useState("");
  const [identifierReady, setIdentifierReady] = useState(false);
  const [requireSellerLogin, setRequireSellerLogin] = useState(false);
  const [settingLoaded, setSettingLoaded] = useState(false);
  const [sellerCodeInput, setSellerCodeInput] = useState("");
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [validatingIdentifier, setValidatingIdentifier] = useState(false);

  // ── Catálogo ────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [armadorPhone, setArmadorPhone] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // ── Estado offline ──────────────────────────────────────────────────────
  const [offlineMode, setOfflineMode] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "done">("idle");

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

  // ── Inicialización: setting + nombre del vendedor desde sessionStorage ───
  useEffect(() => {
    (async () => {
      let requireLogin = false;
      try {
        const { data } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "require_seller_login")
          .maybeSingle();
        requireLogin = data?.value === "true";
      } catch {
        // Offline or error — don't block the seller
        requireLogin = false;
      }
      setRequireSellerLogin(requireLogin);

      const stored =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem(LS_IDENTIFIER)
          : null;
      if (stored && stored.trim()) {
        const validated =
          typeof window !== "undefined"
            ? window.sessionStorage.getItem("charms_seller_validated")
            : null;
        if (!requireLogin || validated === "true") {
          setIdentifier(stored.trim());
          setIdentifierReady(true);
        }
      }
      setSettingLoaded(true);
    })();
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
        const cats = (catRes.data ?? []) as Category[];
        const prods = (prodRes.data ?? []) as Product[];
        const phone = settingsRes.data?.value ?? "";
        setCategories(cats);
        setProducts(prods);
        setArmadorPhone(phone);
        saveCatalogCache(cats, prods, phone);
        setOfflineMode(false);
        setPendingCount(getPendingSales().length);
      } catch {
        if (cancelled) return;
        const cache = loadCatalogCache();
        if (cache) {
          setCategories(cache.categories);
          setProducts(cache.products);
          setArmadorPhone(cache.armadorPhone);
          setOfflineMode(true);
          setPendingCount(getPendingSales().length);
        } else {
          setLoadError("Sin conexión y sin datos guardados. Conéctate al menos una vez.");
        }
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

    const salePayload = {
      items: cart,
      total: cartTotal,
      payment_method: payment,
      customer_name: customerName.trim() || null,
      customer_phone: customerPhone.trim() || null,
      identifier_name: identifier || null,
    };

    try {
      const { data, error } = await supabase
        .from("sales")
        .insert(salePayload)
        .select()
        .single();

      if (error) throw error;
      setCompletedSale(data as Sale);
      setView("success");
    } catch {
      if (!navigator.onLine) {
        const pending = savePendingSale(salePayload);
        setPendingCount(getPendingSales().length);
        setCompletedSale({
          id: pending.localId,
          invoice_number: `LOCAL-${Date.now()}`,
          ticket_number: 0,
          items: cart,
          total: cartTotal,
          payment_method: payment,
          customer_name: customerName.trim() || null,
          customer_phone: customerPhone.trim() || null,
          identifier_name: identifier || null,
          notes: null,
          created_at: pending.createdAt,
        } as Sale);
        setView("success");
      } else {
        setSubmitError("No se pudo guardar la venta. Intenta de nuevo.");
      }
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

  // ── Sincronización de ventas pendientes al recuperar conexión ──────────
  useEffect(() => {
    const syncPending = async () => {
      const pending = getPendingSales();
      if (pending.length === 0) return;
      setSyncStatus("syncing");
      for (const sale of pending) {
        try {
          const { localId, createdAt, ...payload } = sale;
          void createdAt;
          const { error } = await supabase.from("sales").insert(payload);
          if (error) break;
          removePendingSale(localId);
        } catch {
          break;
        }
      }
      setPendingCount(getPendingSales().length);
      setSyncStatus("done");
      setTimeout(() => setSyncStatus("idle"), 3000);
    };

    window.addEventListener("online", syncPending);
    return () => window.removeEventListener("online", syncPending);
  }, []);

  // ── Submit del modal de identificación ──────────────────────────────────
  const submitIdentifier = useCallback(async () => {
    const name = identifierInput.trim();
    if (!name) return;

    if (requireSellerLogin) {
      const code = sellerCodeInput.trim();
      if (!code) return;
      setValidatingIdentifier(true);
      setIdentifierError(null);
      try {
        const { data: seller } = await supabase
          .from("sellers")
          .select("id")
          .eq("active", true)
          .ilike("name", name)
          .eq("code", code)
          .maybeSingle();
        if (!seller) {
          setIdentifierError("Nombre o código de vendedor incorrecto.");
          setValidatingIdentifier(false);
          return;
        }
        window.sessionStorage.setItem("charms_seller_validated", "true");
      } catch {
        // Offline — allow through without blocking the seller
        window.sessionStorage.setItem("charms_seller_validated", "true");
      } finally {
        setValidatingIdentifier(false);
      }
    }

    window.sessionStorage.setItem(LS_IDENTIFIER, name);
    setIdentifier(name);
    setIdentifierReady(true);
  }, [identifierInput, sellerCodeInput, requireSellerLogin]);

  const changeIdentifier = useCallback(() => {
    setIdentifierInput(identifier);
    setSellerCodeInput("");
    setIdentifierError(null);
    setIdentifier("");
    setIdentifierReady(false);
    window.sessionStorage.removeItem(LS_IDENTIFIER);
    window.sessionStorage.removeItem("charms_seller_validated");
  }, [identifier]);

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  // Modal de identificación bloqueante
  if (!identifierReady) {
    // Esperar a que se cargue el setting antes de mostrar el formulario
    if (!settingLoaded) {
      return (
        <main className="min-h-screen flex items-center justify-center bg-cream-100">
          <p className="font-serif italic text-ink-muted">Cargando…</p>
        </main>
      );
    }

    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-cream-100">
        <div className="card-elevated p-8 w-full max-w-md">
          <div className="flex justify-center mb-6">
            <Image
              src="/logo.svg"
              alt="PELGY"
              width={180}
              height={110}
              className="w-40 h-auto"
            />
          </div>
          <h1 className="display-md text-center mb-2">¿Quién está vendiendo?</h1>
          <p className="text-sm text-ink-muted text-center mb-6">
            {requireSellerLogin
              ? "Ingresa tu nombre y código de vendedor para comenzar."
              : "Tu nombre quedará registrado en cada venta del turno."}
          </p>
          <input
            className="input mb-3 text-center"
            type="text"
            placeholder="Tu nombre"
            value={identifierInput}
            onChange={(e) => setIdentifierInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !requireSellerLogin)
                void submitIdentifier();
            }}
            autoFocus
          />
          {requireSellerLogin && (
            <input
              className="input mb-4 text-center font-mono tracking-widest"
              type="password"
              inputMode="numeric"
              placeholder="Código de vendedor"
              value={sellerCodeInput}
              onChange={(e) => setSellerCodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitIdentifier();
              }}
            />
          )}
          {identifierError && (
            <p className="text-red-700 text-sm text-center mb-3">
              {identifierError}
            </p>
          )}
          <button
            className="btn-primary w-full py-5"
            onClick={() => void submitIdentifier()}
            disabled={
              !identifierInput.trim() ||
              (requireSellerLogin && !sellerCodeInput.trim()) ||
              validatingIdentifier
            }
          >
            {validatingIdentifier ? "Verificando…" : "Continuar"}
          </button>
          <Link
            href="/"
            className="block text-center text-sm text-ink-muted mt-6 hover:text-brand-darker"
          >
            ← Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  if (loadingCatalog) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-cream-100">
        <p className="font-serif italic text-ink-muted">Cargando catálogo…</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-cream-100">
        <div className="card p-6 max-w-md">
          <h2 className="display-md text-red-700 mb-2">Error al cargar</h2>
          <p className="text-sm text-ink-muted mb-4 break-words">
            {loadError}
          </p>
          <p className="text-xs text-ink-light mb-4">
            Verifica las variables de entorno de Supabase y que el script{" "}
            <code className="bg-cream-200 px-1 rounded">supabase/schema.sql</code>{" "}
            se haya ejecutado.
          </p>
          <Link href="/" className="btn-secondary w-full block text-center">
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  // ─── Vista: éxito de venta ─────────────────────────────────────────────
  if (view === "success" && completedSale) {
    return (
      <main className="min-h-screen p-4 bg-cream-100">
        <div className="max-w-md mx-auto pt-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand/10 mb-4">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#4F3A26"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h1 className="display-lg mb-3">Venta registrada</h1>
            <div className="flex justify-center gap-6 text-sm">
              <span className="text-ink-muted">
                Factura{" "}
                <span className="font-mono text-ink">
                  {completedSale.invoice_number}
                </span>
              </span>
              <span className="text-ink-muted">
                Ticket{" "}
                <span className="font-mono text-ink">
                  #{completedSale.ticket_number}
                </span>
              </span>
            </div>
          </div>

          <div className="card p-5 mb-6">
            <div className="flex justify-between items-baseline mb-2">
              <span className="eyebrow">Total</span>
              <span className="font-serif text-3xl text-ink">
                {formatCurrency(completedSale.total)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm pt-2 border-t border-cream-300">
              <span className="text-ink-muted">Pago</span>
              <span className="text-ink">
                {PAYMENT_LABELS[completedSale.payment_method]}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 mb-6">
            <button
              className="btn-primary py-5 text-base"
              onClick={openArmadorWhatsApp}
            >
              Enviar al armador
            </button>
            <button className="btn-secondary py-4 text-sm" onClick={handleDownloadPDF}>
              Descargar factura PDF
            </button>
            <button
              className="btn-secondary py-4 text-sm"
              onClick={openCustomerWhatsApp}
              disabled={!completedSale.customer_phone}
              title={
                completedSale.customer_phone
                  ? "Enviar factura al cliente"
                  : "Solo disponible si registraste el celular del cliente"
              }
            >
              Enviar factura al cliente
            </button>
          </div>

          <button
            className="btn-confirm w-full py-6 text-base"
            onClick={resetForNextCustomer}
          >
            Siguiente cliente →
          </button>
        </div>
      </main>
    );
  }

  // ─── Vista: checkout ───────────────────────────────────────────────────
  if (view === "checkout") {
    return (
      <main className="min-h-screen p-4 bg-cream-100">
        <div className="max-w-md mx-auto">
          <button
            className="text-ink-muted text-sm mb-4 hover:text-brand-darker"
            onClick={() => setView("grid")}
            disabled={submitting}
          >
            ← Volver
          </button>

          <div className="mb-6">
            <p className="eyebrow mb-1">Cobrar</p>
            <p className="font-serif text-3xl text-ink">
              {formatCurrency(cartTotal)}
            </p>
            <p className="text-sm text-ink-muted mt-1">
              {cartCount} {cartCount === 1 ? "pieza" : "piezas"}
            </p>
          </div>

          <div className="card p-5 mb-4">
            <h2 className="eyebrow mb-3">Método de pago</h2>
            <div className="grid grid-cols-1 gap-2">
              {(["cash", "nequi", "daviplata"] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  className={`btn-touch py-5 text-base border ${
                    payment === m
                      ? "bg-brand text-white border-brand"
                      : "bg-white text-ink border-cream-300 hover:border-brand"
                  }`}
                  onClick={() => setPayment(m)}
                >
                  {PAYMENT_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-5 mb-4">
            <h2 className="eyebrow mb-3">
              Datos del cliente{" "}
              <span className="text-ink-light normal-case tracking-normal">
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
            className="btn-confirm w-full py-6 text-base"
            onClick={confirmPayment}
            disabled={!payment || submitting}
          >
            {submitting ? "Guardando…" : `Confirmar ${formatCurrency(cartTotal)}`}
          </button>
        </div>
      </main>
    );
  }

  // ─── Vista: grid (default) ─────────────────────────────────────────────
  return (
    <main className="min-h-screen pb-32 bg-cream-100">
      {/* Banner offline */}
      {offlineMode && (
        <div className="bg-neutral-700 text-white text-xs text-center py-2 px-4">
          Sin conexión — mostrando catálogo guardado
          {pendingCount > 0 && ` · ${pendingCount} venta${pendingCount > 1 ? "s" : ""} pendiente${pendingCount > 1 ? "s" : ""} de sincronizar`}
        </div>
      )}
      {!offlineMode && pendingCount > 0 && syncStatus !== "done" && (
        <div className="bg-amber-500 text-white text-xs text-center py-2 px-4">
          {syncStatus === "syncing"
            ? "Sincronizando ventas guardadas…"
            : `${pendingCount} venta${pendingCount > 1 ? "s" : ""} pendiente${pendingCount > 1 ? "s" : ""} de sincronizar`}
        </div>
      )}
      {syncStatus === "done" && (
        <div className="bg-green-600 text-white text-xs text-center py-2 px-4">
          Ventas sincronizadas ✓
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 bg-cream-50/95 backdrop-blur border-b border-cream-300">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="text-ink-muted hover:text-brand-darker"
            aria-label="Volver al inicio"
          >
            ←
          </Link>
          <Image
            src="/logo.svg"
            alt="PELGY"
            width={70}
            height={45}
            className="h-7 w-auto"
          />
          <button
            onClick={changeIdentifier}
            className="text-sm text-ink-muted flex-1 text-right truncate hover:text-brand-darker"
            title="Cambiar de vendedor"
          >
            {identifier}
          </button>
        </div>
        <div className="px-4 pb-3">
          <input
            className="input"
            type="search"
            placeholder="Buscar por nombre o código…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Tabs categorías */}
        <div className="overflow-x-auto scroll-x-hidden border-t border-cream-300/60">
          <div className="flex gap-2 px-4 py-3 min-w-max">
            <CategoryTab
              label="Todos"
              color="#8B7355"
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
          <p className="font-serif italic text-center text-ink-muted py-16">
            {search
              ? "No hay productos que coincidan con tu búsqueda."
              : "Esta categoría no tiene productos todavía."}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {visibleProducts.map((p) => (
              <button
                key={p.id}
                className="card p-4 text-left active:scale-[0.98] transition-all hover:border-brand/50 hover:shadow-md"
                onClick={() => addToCart(p)}
              >
                <div className="w-10 h-10 rounded-full bg-cream-200 flex items-center justify-center mb-3">
                  <span className="font-serif text-lg text-brand-dark">
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="font-medium text-sm leading-tight line-clamp-2 text-ink">
                  {p.name}
                </div>
                <div className="text-xs text-ink-light mt-1 font-mono">
                  {p.code}
                </div>
                <div className="font-serif text-brand-darker text-lg mt-2">
                  {formatCurrency(Number(p.price))}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Carrito flotante */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-cream-50 border-t border-cream-300 shadow-[0_-8px_24px_-12px_rgba(79,58,38,0.15)]">
          <div className="max-w-3xl mx-auto p-3">
            <details className="mb-2">
              <summary className="cursor-pointer text-sm text-ink-muted mb-2 list-none flex items-center justify-between">
                <span>
                  <span className="font-serif">{cartCount}</span>{" "}
                  {cartCount === 1 ? "pieza" : "piezas"} en carrito
                </span>
                <span className="text-xs underline">ver detalle</span>
              </summary>
              <ul className="max-h-48 overflow-y-auto mb-3 divide-y divide-cream-300/60 mt-2">
                {cart.map((it) => (
                  <li
                    key={it.product_id}
                    className="flex items-center gap-2 py-2 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium text-ink">
                        {it.name}
                      </div>
                      <div className="text-xs text-ink-light">
                        {it.code} · {formatCurrency(it.price)}
                      </div>
                    </div>
                    <button
                      className="w-9 h-9 rounded-full bg-cream-200 hover:bg-cream-300 text-ink font-medium"
                      onClick={() => changeQty(it.product_id, -1)}
                      aria-label="Quitar uno"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-medium">
                      {it.quantity}
                    </span>
                    <button
                      className="w-9 h-9 rounded-full bg-cream-200 hover:bg-cream-300 text-ink font-medium"
                      onClick={() => changeQty(it.product_id, +1)}
                      aria-label="Agregar uno"
                    >
                      +
                    </button>
                    <button
                      className="text-ink-light hover:text-red-700 px-2"
                      onClick={() => removeFromCart(it.product_id)}
                      title="Quitar todo"
                      aria-label="Quitar línea"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </details>
            <button
              className="btn-confirm w-full py-5 flex items-center justify-between px-6"
              onClick={() => setView("checkout")}
            >
              <span>Cobrar</span>
              <span className="font-serif text-lg">
                {formatCurrency(cartTotal)}
              </span>
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
      className={`px-5 py-2.5 rounded-full text-sm whitespace-nowrap border transition-all ${
        active
          ? "text-white shadow-sm"
          : "text-ink-muted bg-white hover:text-ink"
      }`}
      style={
        active
          ? { backgroundColor: color, borderColor: color }
          : { borderColor: `${color}40` }
      }
    >
      {label}
    </button>
  );
}
