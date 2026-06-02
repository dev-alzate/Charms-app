"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CartItem,
  Category,
  PAYMENT_LABELS,
  PaymentMethod,
  PaymentMethodConfig,
  Product,
  Sale,
  supabase,
} from "@/lib/supabase";
import {
  buildCustomerMessage,
  buildWhatsAppLink,
  formatCurrency,
} from "@/lib/format";
import { downloadInvoice } from "@/lib/invoice";
import {
  DEFAULT_PAYMENT_METHODS,
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
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  // ── Paginación / scroll infinito ────────────────────────────────────────
  const PAGE_SIZE = 30;
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Refs para acceso estable dentro del IntersectionObserver
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);
  const pageRef = useRef(0);

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
  const [totalCount, setTotalCount] = useState<number | null>(null);

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
        const [catRes, pmRes] = await Promise.all([
          supabase
            .from("categories")
            .select("*")
            .eq("active", true)
            .order("display_order", { ascending: true }),
          supabase
            .from("payment_methods")
            .select("*")
            .eq("active", true)
            .order("display_order", { ascending: true }),
        ]);

        if (catRes.error) throw catRes.error;
        if (cancelled) return;

        const cats = (catRes.data ?? []) as Category[];
        const pms = (pmRes.data ?? []) as PaymentMethodConfig[];
        setCategories(cats);
        setPaymentMethods(pms.length > 0 ? pms : DEFAULT_PAYMENT_METHODS);
        setOfflineMode(false);
        setPendingCount(getPendingSales().length);

        // Calentamiento de caché: carga todos los productos en background
        // para que el modo offline tenga el catálogo completo disponible
        supabase
          .from("products")
          .select("*")
          .eq("active", true)
          .order("display_order", { ascending: true })
          .range(0, 999)
          .then(({ data }) => {
            if (data && !cancelled) {
              const prods = data as Product[];
              saveCatalogCache(
                cats,
                prods,
                pms.length > 0 ? pms : DEFAULT_PAYMENT_METHODS
              );
            }
          });

        setCatalogLoaded(true);
      } catch {
        if (cancelled) return;
        const cache = loadCatalogCache();
        if (cache) {
          setCategories(cache.categories);
          setProducts(cache.products);
          setPaymentMethods(cache.paymentMethods ?? DEFAULT_PAYMENT_METHODS);
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

  // ── Productos visibles: filtrado server-side (online) o client-side (offline) ─
  const displayProducts = useMemo(() => {
    if (!offlineMode) return products; // online → ya filtrados por Supabase

    // Modo offline: filtrar en memoria contra la caché completa
    const q = debouncedSearch.trim().toLowerCase();
    const priceQuery = /^\d{3,}$/.test(q) ? q : null;

    return products.filter((p) => {
      const matchesCategory =
        activeCategoryId === "ALL" || p.category_id === activeCategoryId;
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (priceQuery !== null &&
          String(Math.round(Number(p.price))) === priceQuery);
      return matchesCategory && matchesSearch;
    });
  }, [products, offlineMode, debouncedSearch, activeCategoryId]);

  // ── Totales del carrito ─────────────────────────────────────────────────
  const cartTotal = useMemo(
    () => cart.reduce((sum, it) => sum + it.price * it.quantity, 0),
    [cart]
  );
  const cartCount = useMemo(
    () => cart.reduce((n, it) => n + it.quantity, 0),
    [cart]
  );

  const categoryColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of categories) map[c.id] = c.color;
    return map;
  }, [categories]);

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
          image_url: p.image_url ?? null,
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

  // ── Debounce de búsqueda (300 ms) ──────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Fetch paginado de productos (server-side) ───────────────────────────
  const fetchProducts = useCallback(
    async (reset = false) => {
      if (offlineMode) return; // offline usa la caché completa en memoria
      if (loadingMoreRef.current && !reset) return; // guard anti-duplicados

      loadingMoreRef.current = true;
      setLoadingMore(true);

      const currentPage = reset ? 0 : pageRef.current;
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const q = debouncedSearch.trim().toLowerCase();
      const priceQuery = /^\d{3,}$/.test(q) ? q : null;

      let query = supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("display_order", { ascending: true })
        .range(from, to);

      if (activeCategoryId !== "ALL") {
        query = query.eq("category_id", activeCategoryId);
      }

      if (q) {
        if (priceQuery) {
          query = query.eq("price", Number(priceQuery));
        } else {
          query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%`);
        }
      }

      const { data, error } = await query;
      if (error) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
        return;
      }

      const results = (data ?? []) as Product[];

      if (reset) {
        // Query de conteo en paralelo para la barra de progreso
        setTotalCount(null);
        let cq = supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("active", true);
        if (activeCategoryId !== "ALL") cq = cq.eq("category_id", activeCategoryId);
        if (q) {
          if (priceQuery) cq = cq.eq("price", Number(priceQuery));
          else cq = cq.or(`name.ilike.%${q}%,code.ilike.%${q}%`);
        }
        void cq.then(({ count }) => setTotalCount(count ?? 0));

        setProducts(results);
        pageRef.current = 1;
      } else {
        setProducts((prev) => [...prev, ...results]);
        pageRef.current = currentPage + 1;
      }

      const more = results.length === PAGE_SIZE;
      hasMoreRef.current = more;
      setHasMore(more);
      loadingMoreRef.current = false;
      setLoadingMore(false);
    },
    [offlineMode, debouncedSearch, activeCategoryId]
  );

  // ── Resetear productos cuando cambia el filtro ──────────────────────────
  useEffect(() => {
    if (!catalogLoaded || offlineMode) return;
    setProducts([]);
    loadingMoreRef.current = false;
    hasMoreRef.current = true;
    pageRef.current = 0;
    setHasMore(true);
    void fetchProducts(true);
  }, [fetchProducts, catalogLoaded, offlineMode]);

  // ── IntersectionObserver: cargar más al llegar al final ────────────────
  // catalogLoaded está en deps para que el observer se recree cuando el
  // sentinel aparece en el DOM (antes de que carguen los productos está null)
  useEffect(() => {
    if (!sentinelRef.current || offlineMode) return;
    const sentinel = sentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMoreRef.current &&
          !loadingMoreRef.current
        ) {
          void fetchProducts();
        }
      },
      // rootMargin: empieza a cargar 200 px antes de llegar al fondo
      { threshold: 0, rootMargin: "0px 0px 200px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchProducts, offlineMode, catalogLoaded]);

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
            <button className="btn-primary py-5 text-base" onClick={handleDownloadPDF}>
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

          {/* Método de pago seleccionado — solo lectura */}
          {payment && (
            <div className="card p-4 mb-4 flex items-center justify-between">
              <span className="eyebrow">Método de pago</span>
              <span className="text-sm font-medium text-ink">
                {paymentMethods.find((m) => m.key === payment)?.label ?? payment}
              </span>
            </div>
          )}

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
    <>
      <main className="min-h-screen pb-32 lg:pb-0 lg:mr-80 xl:mr-96 bg-cream-100">
        {/* Banners offline / sync */}
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
          <div className="px-4 py-3 flex items-center">
            <Link
              href="/"
              className="text-sm text-ink-muted hover:text-brand-darker w-16 shrink-0"
              aria-label="Volver al inicio"
            >
              Salir
            </Link>
            <div className="flex-1 flex justify-center">
              <Image
                src="/logo.svg"
                alt="PELGY"
                width={90}
                height={58}
                className="h-9 w-auto"
              />
            </div>
            {/* Avatar circular del vendedor */}
            <button
              onClick={changeIdentifier}
              className="w-16 shrink-0 flex items-center justify-end hover:opacity-75 transition-opacity"
              title={`Vendedor: ${identifier} — toca para cambiar`}
            >
              <span className="w-9 h-9 rounded-full bg-brand/20 text-brand-darker font-serif flex items-center justify-center text-base leading-none select-none">
                {identifier.charAt(0).toUpperCase()}
              </span>
            </button>
          </div>

          {/* Barra de búsqueda */}
          <div className="px-4 pb-3">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
                width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="input pl-9 pr-8"
                type="search"
                placeholder="Buscar por nombre, código, categoría o precio…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink text-lg leading-none"
                  onClick={() => setSearch("")}
                  aria-label="Limpiar búsqueda"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Tabs categorías */}
          <div className="overflow-x-auto border-t border-cream-300/60">
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

        {/* Contador de productos + barra de progreso */}
        {catalogLoaded && (
          <>
            <div className="px-4 py-2 flex items-center justify-between bg-cream-50/60 border-b border-cream-300/40 text-xs text-ink-muted">
              <span>
                Mostrando{" "}
                <span className="font-medium text-ink">{displayProducts.length}</span>
                {totalCount !== null && (
                  <> de <span className="font-medium text-ink">{totalCount}</span></>
                )}{" "}
                producto{displayProducts.length !== 1 ? "s" : ""}
              </span>
              {totalCount !== null && totalCount > displayProducts.length && (
                <span>{totalCount - displayProducts.length} por cargar</span>
              )}
            </div>
            {totalCount !== null && totalCount > 0 && (
              <div className="h-0.5 bg-cream-200">
                <div
                  className="h-full bg-brand/50 transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.round((displayProducts.length / totalCount) * 100))}%`,
                  }}
                />
              </div>
            )}
          </>
        )}

        {/* Grid de productos */}
        <section className="p-3">
          {/* Cargando primera página */}
          {loadingMore && displayProducts.length === 0 && (
            <p className="font-serif italic text-center text-ink-muted py-16">
              Cargando productos…
            </p>
          )}

          {/* Sin resultados */}
          {!loadingMore && displayProducts.length === 0 && (
            <p className="font-serif italic text-center text-ink-muted py-16">
              {search
                ? "No hay productos que coincidan con tu búsqueda."
                : "Esta categoría no tiene productos todavía."}
            </p>
          )}

          {/* Grid */}
          {displayProducts.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {displayProducts.map((p) => {
                const inCart = cart.find((it) => it.product_id === p.id);
                const catColor = (p.category_id ? categoryColorMap[p.category_id] : undefined) ?? "#8B7355";
                return (
                  <button
                    key={p.id}
                    className="card p-0 text-left active:scale-[0.98] transition-all hover:border-brand/50 hover:shadow-md overflow-hidden"
                    onClick={() => addToCart(p)}
                  >
                    {/* Imagen con overlays */}
                    <div className="relative w-full aspect-square bg-cream-200 flex items-center justify-center">
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="font-serif text-3xl text-brand-dark">
                          {p.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      {/* Badge código — top-left */}
                      <span className="absolute top-1.5 left-1.5 bg-black/50 text-white text-[10px] font-mono px-1.5 py-0.5 rounded-sm leading-none">
                        {p.code}
                      </span>
                      {/* Punto de categoría — top-right */}
                      <span
                        className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: catColor }}
                      />
                      {/* Badge cantidad en carrito — bottom-right */}
                      {inCart && (
                        <span className="absolute bottom-1.5 right-1.5 bg-brand text-white text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                          {inCart.quantity}
                        </span>
                      )}
                    </div>
                    {/* Info debajo de la imagen */}
                    <div className="p-2.5">
                      <div className="font-medium text-sm leading-tight line-clamp-2 text-ink mb-0.5">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-ink-light font-mono">
                        {p.code}
                      </div>
                      <div className="font-serif text-brand-darker text-sm mt-1">
                        {formatCurrency(Number(p.price))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Sentinel para IntersectionObserver */}
          {!offlineMode && catalogLoaded && (
            <>
              <div ref={sentinelRef} className="h-8" />
              {loadingMore && displayProducts.length > 0 && (
                <p className="text-center py-4 text-ink-light text-sm font-serif italic">
                  Cargando más…
                </p>
              )}
              {!hasMore && displayProducts.length > 0 && (
                <p className="text-center py-4 text-ink-light text-xs">
                  — Fin del catálogo —
                </p>
              )}
            </>
          )}
        </section>

        {/* Carrito flotante — solo móvil */}
        {cart.length > 0 && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-cream-50 border-t border-cream-300 shadow-[0_-8px_24px_-12px_rgba(79,58,38,0.15)]">
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
                    <li key={it.product_id} className="flex items-center gap-2 py-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium text-ink">{it.name}</div>
                        <div className="text-xs text-ink-light">
                          {it.code} · {formatCurrency(it.price)}
                        </div>
                      </div>
                      <button
                        className="w-9 h-9 rounded-full bg-cream-200 hover:bg-cream-300 text-ink font-medium"
                        onClick={() => changeQty(it.product_id, -1)}
                        aria-label="Quitar uno"
                      >−</button>
                      <span className="w-6 text-center font-medium">{it.quantity}</span>
                      <button
                        className="w-9 h-9 rounded-full bg-cream-200 hover:bg-cream-300 text-ink font-medium"
                        onClick={() => changeQty(it.product_id, +1)}
                        aria-label="Agregar uno"
                      >+</button>
                      <button
                        className="text-ink-light hover:text-red-700 px-2"
                        onClick={() => removeFromCart(it.product_id)}
                        title="Quitar todo"
                        aria-label="Quitar línea"
                      >×</button>
                    </li>
                  ))}
                </ul>
              </details>
              {/* Método de pago — móvil */}
              {paymentMethods.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-widest text-ink-muted mb-2">
                    Método de pago
                  </p>
                  <div className={`grid gap-2 ${paymentMethods.length <= 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                    {paymentMethods.map((m) => (
                      <button
                        key={m.key}
                        onClick={() =>
                          setPayment(
                            payment === (m.key as PaymentMethod) ? null : (m.key as PaymentMethod)
                          )
                        }
                        className={`flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border text-xs font-medium transition-all ${
                          payment === m.key
                            ? "bg-brand border-brand text-white"
                            : "bg-white border-cream-300 text-ink-muted"
                        }`}
                      >
                        <PmIconSale pmKey={m.key} selected={payment === m.key} />
                        <span className="leading-none">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button
                className="btn-confirm w-full py-5 flex items-center justify-between px-6"
                onClick={() => setView("checkout")}
              >
                <span>Cobrar</span>
                <span className="font-serif text-lg">{formatCurrency(cartTotal)}</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── Sidebar derecho — solo desktop (lg+) ───────────────────────────── */}
      <aside className="hidden lg:flex fixed right-0 top-0 h-screen w-80 xl:w-96 flex-col bg-white border-l border-cream-300 z-10">
        {/* Header del sidebar */}
        <div className="px-5 py-4 border-b border-cream-300 flex items-center justify-between flex-shrink-0">
          <h2 className="font-serif text-lg text-ink">Orden actual</h2>
          {cart.length > 0 && (
            <span className="text-xs text-ink-muted bg-cream-100 px-2.5 py-1 rounded-full border border-cream-300">
              {cartCount} {cartCount === 1 ? "pieza" : "piezas"}
            </span>
          )}
        </div>

        {/* Lista de items — scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
              <svg
                width="52" height="52" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
                className="text-cream-300"
              >
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              <p className="text-sm text-ink-muted leading-relaxed">
                El carrito está vacío.<br />
                Toca un producto para agregar.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-cream-100 py-1">
              {cart.map((it) => (
                <li key={it.product_id} className="px-4 py-3">
                  <div className="flex items-start gap-3 mb-2">
                    {/* Miniatura del producto */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-cream-200 flex items-center justify-center flex-shrink-0">
                      {it.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.image_url}
                          alt={it.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="font-serif text-lg text-brand-dark">
                          {it.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink leading-tight line-clamp-2">
                        {it.name}
                      </div>
                      <div className="text-xs text-ink-light font-mono mt-0.5">{it.code}</div>
                    </div>
                    <button
                      onClick={() => removeFromCart(it.product_id)}
                      className="text-ink-light hover:text-red-600 transition-colors text-xl leading-none flex-shrink-0 mt-0.5"
                      aria-label="Quitar producto"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => changeQty(it.product_id, -1)}
                        className="w-7 h-7 rounded-full bg-cream-100 hover:bg-cream-200 text-ink text-sm font-medium border border-cream-300 transition-colors"
                      >−</button>
                      <span className="w-5 text-center text-sm font-semibold text-ink">
                        {it.quantity}
                      </span>
                      <button
                        onClick={() => changeQty(it.product_id, +1)}
                        className="w-7 h-7 rounded-full bg-cream-100 hover:bg-cream-200 text-ink text-sm font-medium border border-cream-300 transition-colors"
                      >+</button>
                    </div>
                    <span className="font-serif text-sm text-ink">
                      {formatCurrency(it.price * it.quantity)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer: totales + método de pago + cobrar */}
        <div className="border-t border-cream-300 p-4 flex-shrink-0 bg-cream-50/50">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-ink-muted">Subtotal</span>
            <span className="text-ink">{formatCurrency(cartTotal)}</span>
          </div>
          <div className="flex justify-between items-baseline mb-4">
            <span className="font-semibold text-ink">Total</span>
            <span className="font-serif text-2xl text-ink">{formatCurrency(cartTotal)}</span>
          </div>

          {/* Métodos de pago */}
          {paymentMethods.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-widest text-ink-muted mb-2">
                Método de pago
              </p>
              <div
                className={`grid gap-2 mb-4 ${
                  paymentMethods.length <= 2 ? "grid-cols-2" : "grid-cols-3"
                }`}
              >
                {paymentMethods.map((m) => (
                  <button
                    key={m.key}
                    onClick={() =>
                      setPayment(
                        payment === (m.key as PaymentMethod)
                          ? null
                          : (m.key as PaymentMethod)
                      )
                    }
                    className={`flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border text-xs font-medium transition-all ${
                      payment === m.key
                        ? "bg-brand border-brand text-white"
                        : "bg-white border-cream-300 text-ink-muted hover:border-brand/40 hover:text-ink"
                    }`}
                  >
                    <PmIconSale pmKey={m.key} selected={payment === m.key} />
                    <span className="leading-none truncate w-full text-center">
                      {m.label}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Botón cobrar */}
          <button
            className="btn-confirm w-full py-4 flex items-center justify-between px-5 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => setView("checkout")}
            disabled={cart.length === 0}
          >
            <span className="font-medium">Cobrar</span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </aside>
    </>
  );
}

// ─── Subcomponente: iconos de método de pago (sidebar) ────────────────────

function PmIconSale({ pmKey, selected }: { pmKey: string; selected: boolean }) {
  const c = selected ? "white" : "currentColor";
  if (pmKey === "cash")
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2" />
        <path d="M6 12h.01M18 12h.01" />
      </svg>
    );
  if (pmKey === "transfer")
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3L4 7l4 4" /><path d="M4 7h16" />
        <path d="M16 21l4-4-4-4" /><path d="M20 17H4" />
      </svg>
    );
  if (pmKey === "card")
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    );
  return <span className="w-5 h-5 block" />;
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
