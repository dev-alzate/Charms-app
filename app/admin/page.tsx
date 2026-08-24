"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Category,
  PAYMENT_LABELS,
  PaymentMethodConfig,
  Product,
  Sale,
  Seller,
  supabase,
} from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/format";

// ═════════════════════════════════════════════════════════════════════════════
// Iconos SVG
// ═════════════════════════════════════════════════════════════════════════════

function IconHome() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}
function IconGear() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}
function IconBox() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  );
}
function IconTag() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
}
function IconUpload() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}
function IconStore() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Configuración del sidebar
// ═════════════════════════════════════════════════════════════════════════════

type TabKey = "home" | "config" | "products" | "categories" | "sales" | "import" | "sellers";

interface TabMeta {
  key: TabKey;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const TABS: TabMeta[] = [
  { key: "home",       label: "Inicio",         description: "Bienvenido al panel de administración PELGY.",                         icon: <IconHome /> },
  { key: "config",     label: "Configuración",  description: "Personaliza los métodos de pago y el acceso de vendedores.",          icon: <IconGear /> },
  { key: "products",   label: "Productos",      description: "Gestiona el catálogo de productos de la tienda.",                     icon: <IconBox /> },
  { key: "categories", label: "Categorías",     description: "Organiza los productos por categorías.",                              icon: <IconTag /> },
  { key: "sales",      label: "Ventas",         description: "Consulta las ventas registradas y el resumen del día.",               icon: <IconChart /> },
  { key: "import",     label: "Importar",       description: "Carga productos desde un archivo CSV.",                               icon: <IconUpload /> },
  { key: "sellers",    label: "Vendedores",     description: "Administra los vendedores que atienden en feria.",                    icon: <IconUsers /> },
];

const SIDEBAR_BG = "#2C1A0E";

// ═════════════════════════════════════════════════════════════════════════════
// Página principal
// ═════════════════════════════════════════════════════════════════════════════

export default function AdminPage() {
  const [tab, setTab] = useState<TabKey>("home");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auto-collapse on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setCollapsed(true);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const current = TABS.find((t) => t.key === tab)!;

  return (
    <div className="flex min-h-screen relative">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      {/* Backdrop móvil */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`flex flex-col flex-shrink-0 transition-all duration-200
          fixed md:relative inset-y-0 left-0 z-50 md:z-auto
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
        style={{ backgroundColor: SIDEBAR_BG, width: collapsed ? 64 : 256 }}
      >
        {/* Branding + colapsar */}
        <div
          className={`flex items-center py-5 px-4 ${collapsed ? "justify-center" : "justify-between"}`}
          style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
        >
          {!collapsed && (
            <div>
              <p className="font-serif text-white text-lg tracking-wide leading-none">
                PELGY
              </p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                Panel POS
              </p>
            </div>
          )}
          <button
            onClick={() => {
              if (window.innerWidth < 768) setMobileOpen(false);
              else setCollapsed(!collapsed);
            }}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.5)" }}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {collapsed
                ? <polyline points="9 18 15 12 9 6" />
                : <polyline points="15 18 9 12 15 6" />}
            </svg>
          </button>
        </div>

        {/* Navegación principal */}
        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          {!collapsed && (
            <p
              className="text-xs uppercase tracking-widest px-3 mb-2"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              MENÚ
            </p>
          )}
          <div className="space-y-0.5">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => { setTab(t.key); setMobileOpen(false); }}
                  title={collapsed ? t.label : undefined}
                  className={`flex items-center w-full rounded-lg text-sm transition-all ${
                    collapsed ? "justify-center px-0 py-3" : "gap-3 px-3 py-2.5"
                  }`}
                  style={{
                    backgroundColor: active ? "rgba(255,255,255,0.13)" : "transparent",
                    color: active ? "white" : "rgba(255,255,255,0.55)",
                  }}
                  onMouseEnter={(e) => {
                    if (!active)
                      (e.currentTarget as HTMLButtonElement).style.color = "white";
                  }}
                  onMouseLeave={(e) => {
                    if (!active)
                      (e.currentTarget as HTMLButtonElement).style.color =
                        "rgba(255,255,255,0.55)";
                  }}
                >
                  <span className="w-5 h-5 flex-shrink-0">{t.icon}</span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{t.label}</span>
                      {active && (
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: "rgba(255,255,255,0.8)" }}
                        />
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Zona inferior */}
        <div
          className="py-3 px-2 space-y-0.5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
        >
          {[
            {
              label: "Inicio",
              icon: <IconStore />,
              action: null as null,
              href: "/" as string,
            },
          ].map(() => (
            <Link
              key="store"
              href="/"
              title={collapsed ? "Ir a la tienda" : undefined}
              className={`flex items-center w-full rounded-lg text-sm transition-all ${
                collapsed ? "justify-center px-0 py-3" : "gap-3 px-3 py-2.5"
              }`}
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              <span className="w-5 h-5 flex-shrink-0">
                <IconStore />
              </span>
              {!collapsed && <span>Inicio</span>}
            </Link>
          ))}
          <button
            data-testid="logout-btn"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title={collapsed ? "Cerrar sesión" : undefined}
            className={`flex items-center w-full rounded-lg text-sm transition-all ${
              collapsed ? "justify-center px-0 py-3" : "gap-3 px-3 py-2.5"
            }`}
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            <span className="w-5 h-5 flex-shrink-0">
              <IconLogout />
            </span>
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {/* ── Contenido ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-auto bg-cream-100">
        {/* Cabecera de sección */}
        <div className="bg-cream-50 border-b border-cream-300 px-4 md:px-8 py-4 md:py-6">
          <div className="flex items-center gap-3 md:gap-4">
            {/* Botón hamburguesa — solo móvil */}
            <button
              className="md:hidden p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-cream-200 transition-colors flex-shrink-0"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-cream-200 flex items-center justify-center text-brand-darker flex-shrink-0">
              {current.icon}
            </div>
            <div>
              <h1 className="font-serif text-xl md:text-2xl text-ink leading-tight">
                {current.label}
              </h1>
              <p className="text-xs md:text-sm text-ink-muted mt-0.5">{current.description}</p>
            </div>
          </div>
        </div>

        {/* Contenido del tab */}
        <section data-testid="admin-content" className="flex-1 p-4 md:p-8">
          {tab === "home"       && <HomeTab onNavigate={setTab} />}
          {tab === "config"     && <ConfigTab />}
          {tab === "products"   && <ProductsTab />}
          {tab === "categories" && <CategoriesTab />}
          {tab === "sales"      && <SalesTab />}
          {tab === "import"     && <ImportTab />}
          {tab === "sellers"    && <SellersTab />}
        </section>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab: Inicio (bienvenida)
// ═════════════════════════════════════════════════════════════════════════════

function HomeTab({ onNavigate }: { onNavigate: (tab: TabKey) => void }) {
  const shortcuts = TABS.filter((t) => t.key !== "home");
  return (
    <div className="flex flex-col items-center justify-center min-h-[55vh] text-center">
      <Image
        src="/logo.svg"
        alt="PELGY"
        width={200}
        height={120}
        className="w-44 h-auto mb-6 opacity-90"
        priority
      />
      <div className="divider-ornament mb-5">
        <span className="font-serif italic text-sm">Panel de administración</span>
      </div>
      <h2 className="font-serif text-2xl text-ink mb-3">
        Bienvenido, gestiona tu aplicación
      </h2>
      <p className="text-sm text-ink-muted max-w-sm mb-10">
        Configura métodos de pago, administra el catálogo de productos,
        revisa el historial de ventas y mucho más.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-lg">
        {shortcuts.map((t) => (
          <button
            key={t.key}
            onClick={() => onNavigate(t.key)}
            className="card p-4 text-left hover:border-brand/50 hover:shadow-md transition-all active:scale-[0.98]"
          >
            <span className="text-brand-darker mb-2 block">{t.icon}</span>
            <p className="text-sm font-medium text-ink">{t.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab: Configuración
// ═════════════════════════════════════════════════════════════════════════════

const PM_META: Record<string, { description: string; icon: React.ReactNode }> = {
  cash: {
    description: "Pagos en efectivo en caja",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/>
        <path d="M6 12h.01M18 12h.01"/>
      </svg>
    ),
  },
  transfer: {
    description: "Transferencias bancarias y PSE",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
        <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
      </svg>
    ),
  },
  card: {
    description: "Tarjetas débito y crédito",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
        <line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
    ),
  },
};

function Toggle({
  on,
  disabled,
  onChange,
}: {
  on: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onChange}
      disabled={disabled}
     className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
  disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
} ${on ? "bg-brand" : "bg-gray-300"}`}
>
  <span
    className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
      on ? "translate-x-5" : "translate-x-0"
    }`}
  />
    </button>
  );
}

function ConfigTab() {
  const [requireSellerLogin, setRequireSellerLogin] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSellerLogin, setSavingSellerLogin] = useState(false);
  const [savingPm, setSavingPm] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [settingRes, pmRes] = await Promise.all([
          supabase
            .from("settings")
            .select("value")
            .eq("key", "require_seller_login")
            .maybeSingle(),
          supabase
            .from("payment_methods")
            .select("*")
            .order("display_order", { ascending: true }),
        ]);
        setRequireSellerLogin(settingRes.data?.value === "true");
        setPaymentMethods((pmRes.data ?? []) as PaymentMethodConfig[]);
      } catch {
        // tabla aún no creada
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveSellerLogin = async (val: boolean) => {
    setSavingSellerLogin(true);
    await supabase
      .from("settings")
      .upsert({ key: "require_seller_login", value: val ? "true" : "false" });
    setSavingSellerLogin(false);
    setRequireSellerLogin(val);
  };

  const togglePaymentMethod = async (pm: PaymentMethodConfig) => {
    setSavingPm(pm.key);
    await supabase
      .from("payment_methods")
      .update({ active: !pm.active })
      .eq("id", pm.id);
    setPaymentMethods((prev) =>
      prev.map((m) => (m.id === pm.id ? { ...m, active: !m.active } : m))
    );
    setSavingPm(null);
  };

  if (loading)
    return <p className="font-serif italic text-ink-muted">Cargando…</p>;

  const activeCount = paymentMethods.filter((m) => m.active).length;

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      {/* Métodos de pago */}
      <div className="card p-5">
        <div className="flex items-start justify-between mb-2">
          <h2 className="display-md">Métodos de pago</h2>
          <span className="text-center leading-tight px-3 py-1.5 rounded-xl bg-cream-200 text-xs font-semibold text-ink-muted tracking-widest">
            {activeCount}<br />ACTIVOS
          </span>
        </div>
        <p className="text-sm text-ink-muted mb-5">
          Activa los métodos que aparecen en la pantalla de venta. Al menos
          uno debe quedar activo.
        </p>
        <div className="flex flex-col gap-3">
          {paymentMethods.map((pm) => {
            const meta = PM_META[pm.key];
            const isLastActive = pm.active && activeCount === 1;
            const isSaving = savingPm === pm.key;
            return (
              <div
                key={pm.id}
                className={`flex items-center gap-4 p-3 rounded-xl transition-colors ${
                  pm.active ? "bg-cream-100" : "bg-cream-50"
                }`}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{
                    backgroundColor: pm.active ? SIDEBAR_BG : "#c4b5a5",
                    color: "white",
                  }}
                >
                  {meta?.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${pm.active ? "text-ink" : "text-ink-muted"}`}>
                    {pm.label}
                  </p>
                  <p className="text-xs text-ink-light mt-0.5">
                    {meta?.description ?? ""}
                  </p>
                </div>
                {isSaving ? (
                  <span className="text-xs text-ink-light italic">Guardando…</span>
                ) : (
                  <Toggle
                    on={pm.active}
                    disabled={isLastActive}
                    onChange={() => !isLastActive && togglePaymentMethod(pm)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Login de vendedores */}
      <div className="card p-5">
        <h2 className="display-md mb-2">Login de vendedores</h2>
        <p className="text-sm text-ink-muted mb-5">
          Cuando está activo, los vendedores deben ingresar su nombre y código
          al iniciar turno en la pantalla de venta. Gestiona los vendedores en
          la sección <strong>Vendedores</strong>.
        </p>
        <div className="flex items-center gap-4 p-3 rounded-xl bg-cream-100">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: requireSellerLogin ? SIDEBAR_BG : "#c4b5a5",
              color: "white",
            }}
          >
            <IconUsers />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink">
              Requerir login de vendedor
            </p>
            <p className="text-xs text-ink-light mt-0.5">
              Solicita identificación al iniciar turno
            </p>
          </div>
          {savingSellerLogin ? (
            <span className="text-xs text-ink-light italic">Guardando…</span>
          ) : (
            <Toggle
              on={requireSellerLogin}
              onChange={() => saveSellerLogin(!requireSellerLogin)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab: Productos
// ═════════════════════════════════════════════════════════════════════════════

const PRODUCTS_PAGE_SIZE = 20;

function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<string | "ALL">("ALL");
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const [prodRes, catRes] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .order("display_order", { ascending: true }),
      supabase
        .from("categories")
        .select("*")
        .order("display_order", { ascending: true }),
    ]);
    setProducts((prodRes.data ?? []) as Product[]);
    setCategories((catRes.data ?? []) as Category[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let result = filterCat === "ALL"
      ? products
      : products.filter((p) => p.category_id === filterCat);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.code.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q)
      );
    }
    return result;
  }, [products, filterCat, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PAGE_SIZE));
  const visible = useMemo(
    () => filtered.slice((page - 1) * PRODUCTS_PAGE_SIZE, page * PRODUCTS_PAGE_SIZE),
    [filtered, page]
  );

  useEffect(() => { setPage(1); }, [search, filterCat]);

  const toggleActive = async (p: Product) => {
    await supabase
      .from("products")
      .update({ active: !p.active })
      .eq("id", p.id);
    load();
  };

  const remove = async (p: Product) => {
    if (!confirm(`¿Eliminar definitivamente "${p.name}"?`)) return;
    await supabase.from("products").delete().eq("id", p.id);
    load();
  };

  if (loading)
    return <p className="font-serif italic text-ink-muted">Cargando…</p>;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <select
          className="input max-w-xs"
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value as string | "ALL")}
        >
          <option value="ALL">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
            width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="input pl-9 pr-8"
            type="text"
            placeholder="Buscar por código o nombre…"
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
        <button
          className="btn-primary"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          + Nuevo producto
        </button>
      </div>

      {showForm && (
        <ProductForm
          categories={categories}
          product={editing}
          onCancel={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream-100 text-left text-ink-muted text-xs uppercase tracking-widest">
            <tr>
              <th className="p-3">Código</th>
              <th className="p-3">Nombre</th>
              <th className="p-3">Precio</th>
              <th className="p-3">Categoría</th>
              <th className="p-3">Activo</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => {
              const cat = categories.find((c) => c.id === p.category_id);
              return (
                <tr key={p.id} className="border-t border-cream-300/50">
                  <td className="p-3 font-mono text-xs">{p.code}</td>
                  <td className="p-3">{p.name}</td>
                  <td className="p-3">{formatCurrency(Number(p.price))}</td>
                  <td className="p-3">
                    {cat ? (
                      <span
                        className="px-2 py-0.5 rounded text-xs text-white"
                        style={{ backgroundColor: cat.color }}
                      >
                        {cat.name}
                      </span>
                    ) : (
                      <span className="text-ink-light text-xs">Sin categoría</span>
                    )}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => toggleActive(p)}
                      className={`px-2 py-1 rounded text-xs ${
                        p.active
                          ? "bg-brand/10 text-brand-darker"
                          : "bg-cream-200 text-ink-light"
                      }`}
                    >
                      {p.active ? "Sí" : "No"}
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      className="text-brand mr-2"
                      onClick={() => {
                        setEditing(p);
                        setShowForm(true);
                      }}
                    >
                      Editar
                    </button>
                    <button className="text-red-700" onClick={() => remove(p)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-ink-light">
                  {search ? "Sin resultados para esa búsqueda." : "Sin productos."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm text-ink-muted">
          <span>
            {filtered.length} producto{filtered.length !== 1 ? "s" : ""} · página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              className="btn-secondary py-1 px-3 text-xs"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              ← Anterior
            </button>
            <button
              className="btn-secondary py-1 px-3 text-xs"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductForm({
  categories,
  product,
  onCancel,
  onSaved,
}: {
  categories: Category[];
  product: Product | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState(product?.code ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [categoryId, setCategoryId] = useState<string>(
    product?.category_id ?? categories[0]?.id ?? ""
  );
  const [active, setActive] = useState(product?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    product?.image_url ?? null
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>(product?.image_url ?? "");

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageUrl("");
  };

  const handleImageUrlChange = (url: string) => {
    setImageUrl(url);
    if (!imageFile) {
      setImagePreview(isValidImageUrl(url) ? url : null);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);

    let final_image_url: string | null = null;

    // Priority 1: File upload (generates Storage URL)
    if (imageFile) {
      setUploadingImage(true);
      const ext = imageFile.name.split(".").pop() ?? "jpg";
      const path = `products/${code.trim() || Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(path, imageFile, { upsert: true });

      if (uploadError) {
        setError(`Error al subir imagen: ${uploadError.message}`);
        setSaving(false);
        setUploadingImage(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(path);
      final_image_url = urlData.publicUrl;
      setUploadingImage(false);
    }
    // Priority 2: URL input (if valid)
    else if (imageUrl && isValidImageUrl(imageUrl)) {
      final_image_url = imageUrl.trim();
    }
    // Priority 3: Existing image (for updates, don't clear if nothing provided)
    else if (product?.image_url) {
      final_image_url = product.image_url;
    }

    const payload = {
      code: code.trim(),
      name: name.trim(),
      price: Number(price),
      category_id: categoryId || null,
      image_url: final_image_url,
      active,
    };

    const { error: saveError } = product
      ? await supabase.from("products").update(payload).eq("id", product.id)
      : await supabase.from("products").insert(payload);
    setSaving(false);
    if (saveError) setError(saveError.message);
    else onSaved();
  };

  return (
    <div className="card-elevated p-5 mb-4 border-brand/40 border">
      <h3 className="font-serif text-lg mb-4 text-ink">
        {product ? "Editar producto" : "Nuevo producto"}
      </h3>

      <div className="mb-4">
        <p className="eyebrow mb-2">Foto del producto</p>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl border border-cream-300 overflow-hidden bg-cream-100 flex items-center justify-center flex-shrink-0">
            {imagePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imagePreview}
                alt="Vista previa"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-serif text-2xl text-brand-dark">
                {name.charAt(0).toUpperCase() || "?"}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="btn-secondary text-xs py-2 px-3 cursor-pointer">
              {imagePreview ? "Cambiar foto" : "Subir foto"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImagePick}
              />
            </label>
            {imagePreview && (
              <button
                type="button"
                onClick={removeImage}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Quitar foto
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-ink-light mt-2">
          Acepta JPG, PNG o WEBP. Se recomienda foto cuadrada.
        </p>
      </div>

      <div className="mb-4">
        <p className="eyebrow mb-2">O pega una URL de imagen</p>
        <input
          type="text"
          className="input"
          placeholder="https://ejemplo.com/imagen.jpg"
          value={imageUrl}
          onChange={(e) => handleImageUrlChange(e.target.value)}
        />
        <p className="text-xs text-ink-light mt-2">
          Acepta URLs que empiezan con http:// o https://. Si cargas un archivo, la URL se ignora.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          className="input"
          placeholder="Código (ej: L-A)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <input
          className="input"
          placeholder="Nombre (ej: Letra A)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input"
          type="number"
          placeholder="Precio"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <select
          className="input"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Activo
        </label>
      </div>

      {error && <p className="text-red-700 text-sm mt-2">{error}</p>}

      <div className="flex gap-2 mt-4">
        <button
          className="btn-primary"
          onClick={save}
          disabled={saving || uploadingImage || !code.trim() || !name.trim() || !price || !!(imageUrl && !isValidImageUrl(imageUrl))}
        >
          {uploadingImage ? "Subiendo imagen…" : saving ? "Guardando..." : "Guardar"}
        </button>
        <button className="btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab: Categorías
// ═════════════════════════════════════════════════════════════════════════════

function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("display_order", { ascending: true });
    setCategories((data ?? []) as Category[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (c: Category) => {
    await supabase
      .from("categories")
      .update({ active: !c.active })
      .eq("id", c.id);
    load();
  };

  const remove = async (c: Category) => {
    if (!confirm(`¿Eliminar "${c.name}"? Los productos quedarán sin categoría.`)) return;
    await supabase.from("categories").delete().eq("id", c.id);
    load();
  };

  if (loading)
    return <p className="font-serif italic text-ink-muted">Cargando…</p>;

  return (
    <div>
      <button
        className="btn-primary mb-4"
        onClick={() => {
          setEditing(null);
          setShowForm(true);
        }}
      >
        + Nueva categoría
      </button>

      {showForm && (
        <CategoryForm
          category={editing}
          onCancel={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream-100 text-left text-ink-muted text-xs uppercase tracking-widest">
            <tr>
              <th className="p-3">Color</th>
              <th className="p-3">Nombre</th>
              <th className="p-3">Orden</th>
              <th className="p-3">Activa</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-t border-cream-300/50">
                <td className="p-3">
                  <span
                    className="inline-block w-6 h-6 rounded"
                    style={{ backgroundColor: c.color }}
                  />
                </td>
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.display_order}</td>
                <td className="p-3">
                  <button
                    onClick={() => toggleActive(c)}
                    className={`px-2 py-1 rounded text-xs ${
                      c.active
                        ? "bg-brand/10 text-brand-darker"
                        : "bg-cream-200 text-ink-light"
                    }`}
                  >
                    {c.active ? "Sí" : "No"}
                  </button>
                </td>
                <td className="p-3 text-right">
                  <button
                    className="text-brand mr-2"
                    onClick={() => {
                      setEditing(c);
                      setShowForm(true);
                    }}
                  >
                    Editar
                  </button>
                  <button className="text-red-700" onClick={() => remove(c)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-ink-light">
                  Sin categorías.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoryForm({
  category,
  onCancel,
  onSaved,
}: {
  category: Category | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [color, setColor] = useState(category?.color ?? "#7C3AED");
  const [order, setOrder] = useState(
    category ? String(category.display_order) : "0"
  );
  const [active, setActive] = useState(category?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      color,
      display_order: Number(order) || 0,
      active,
    };
    const { error } = category
      ? await supabase.from("categories").update(payload).eq("id", category.id)
      : await supabase.from("categories").insert(payload);
    setSaving(false);
    if (error) setError(error.message);
    else onSaved();
  };

  return (
    <div className="card-elevated p-5 mb-4 border-brand/40 border">
      <h3 className="font-serif text-lg mb-4 text-ink">
        {category ? "Editar categoría" : "Nueva categoría"}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          className="input"
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-14 h-12 rounded-lg border border-cream-300"
          />
          <input
            className="input flex-1 font-mono"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </div>
        <input
          className="input"
          type="number"
          placeholder="Orden de visualización"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Activa
        </label>
      </div>
      {error && <p className="text-red-700 text-sm mt-2">{error}</p>}
      <div className="flex gap-2 mt-4">
        <button
          className="btn-primary"
          onClick={save}
          disabled={saving || !name.trim()}
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button className="btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab: Ventas
// ═════════════════════════════════════════════════════════════════════════════

const SALES_PAGE_SIZE = 30;

function SalesTab() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const offsetRef = useRef(0);

  const loadSales = useCallback(
    async (reset = true) => {
      if (reset) {
        setSales([]);
        offsetRef.current = 0;
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      let query = supabase
        .from("sales")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (search.trim()) {
        query = query.ilike("invoice_number", `%${search}%`);
      }

      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        query = query.gte("created_at", fromDate.toISOString());
      }

      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte("created_at", toDate.toISOString());
      }

      const offset = reset ? 0 : offsetRef.current;
      const { data, count, error } = await query
        .range(offset, offset + SALES_PAGE_SIZE - 1);

      if (!error) {
        const newSales = (data ?? []) as Sale[];
        setSales((prev) => (reset ? newSales : [...prev, ...newSales]));
        offsetRef.current += SALES_PAGE_SIZE;
        setHasMore((count ?? 0) > offset + SALES_PAGE_SIZE);
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [search, dateFrom, dateTo]
  );

  useEffect(() => {
    loadSales(true);
  }, [loadSales]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (observerRef.current) observerRef.current.disconnect();

    const sentinel = document.createElement("div");
    sentinel.id = "scroll-sentinel";
    container.appendChild(sentinel);

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadSales(false);
        }
      },
      { threshold: 0.5 }
    );

    observerRef.current.observe(sentinel);

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
      sentinel.remove();
    };
  }, [hasMore, loadingMore, loadSales]);

  const todaySummary = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const todays = sales.filter((s) => new Date(s.created_at) >= start);
    const total = todays.reduce((sum, s) => sum + Number(s.total), 0);
    return { count: todays.length, total };
  }, [sales]);

  return (
    <div>
      <div className="card p-6 mb-4 flex flex-wrap gap-10">
        <div>
          <div className="eyebrow mb-1">Ventas hoy</div>
          <div className="font-serif text-4xl text-ink">{todaySummary.count}</div>
        </div>
        <div>
          <div className="eyebrow mb-1">Ingresos hoy</div>
          <div className="font-serif text-4xl text-brand-darker">
            {formatCurrency(todaySummary.total)}
          </div>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs eyebrow mb-2">Buscar factura</label>
            <input
              type="text"
              className="input"
              placeholder="Ej: F-2026"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs eyebrow mb-2">Desde</label>
            <input
              type="date"
              className="input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs eyebrow mb-2">Hasta</label>
            <input
              type="date"
              className="input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <button
            className="btn-secondary py-2 text-xs"
            onClick={() => {
              setSearch("");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      <div className="card overflow-hidden" ref={scrollContainerRef}>
        <table className="w-full text-sm">
          <thead className="bg-cream-100 text-left text-ink-muted text-xs uppercase tracking-widest">
            <tr>
              <th className="p-3">Factura</th>
              <th className="p-3">Ticket</th>
              <th className="p-3">Fecha</th>
              <th className="p-3">Atendió</th>
              <th className="p-3">Pago</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3">PDF</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-ink-muted font-serif italic">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && sales.map((s) => (
              <tr key={s.id} className="border-t border-cream-300/50">
                <td className="p-3 font-mono text-xs">{s.invoice_number}</td>
                <td className="p-3">#{s.ticket_number}</td>
                <td className="p-3">{formatDate(s.created_at)}</td>
                <td className="p-3">{s.identifier_name ?? "—"}</td>
                <td className="p-3">{PAYMENT_LABELS[s.payment_method]}</td>
                <td className="p-3 text-right font-semibold">
                  {formatCurrency(Number(s.total))}
                </td>
                <td className="p-3 text-center">
                  {s.pdf_url ? (
                    <a
                      href={s.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:text-brand-darker text-xs font-semibold"
                    >
                      Ver PDF
                    </a>
                  ) : (
                    <span className="text-ink-light text-xs">Sin PDF</span>
                  )}
                </td>
              </tr>
            ))}
            {sales.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-ink-light">
                  {search || dateFrom || dateTo
                    ? "No hay ventas que coincidan con los filtros."
                    : "Aún no hay ventas registradas."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {loadingMore && (
          <div className="p-4 text-center text-sm text-ink-muted">
            Cargando más ventas…
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab: Importar
// ═════════════════════════════════════════════════════════════════════════════

const HEADER_ALIASES: Record<string, string[]> = {
  code: ["code", "codigo", "código", "ref", "referencia", "sku"],
  name: ["name", "nombre", "producto", "descripcion", "descripción"],
  price: ["price", "precio", "valor", "costo"],
  category: ["category", "categoria", "categoría", "cat"],
  image: ["image", "image_url", "imagen", "imagenes", "imágenes", "url_imagen", "images", "Imágenes"],
};

function detectSeparator(line: string): string {
  if (line.includes("\t")) return "\t";
  if (line.includes(";")) return ";";
  return ",";
}

function normalizeHeader(raw: string): keyof typeof HEADER_ALIASES | null {
  const k = raw.trim().toLowerCase().replace(/^["']|["']$/g, "");
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(k)) return canonical as keyof typeof HEADER_ALIASES;
  }
  return null;
}

function stripQuotes(s: string): string {
  return s.trim().replace(/^["']|["']$/g, "");
}

function isValidImageUrl(url: string): boolean {
  if (!url || url.trim().length === 0) return false;
  const trimmed = url.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

interface ImportResult {
  created: number;
  updated: number;
  errors: { row: number; reason: string }[];
  products_with_images?: number;
}

function ImportTab() {
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  const runImport = async () => {
    setRunning(true);
    setResult(null);
    setProgress("Procesando archivo…");
    const res: ImportResult = { created: 0, updated: 0, errors: [] };

    try {
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (lines.length < 2) {
        res.errors.push({ row: 0, reason: "Se necesitan al menos cabecera + 1 fila" });
        setResult(res);
        return;
      }

      const sep = detectSeparator(lines[0]);
      const headerCells = lines[0].split(sep).map(stripQuotes);
      const headerMap: Record<number, string> = {};
      headerCells.forEach((h, i) => {
        const norm = normalizeHeader(h);
        if (norm) headerMap[i] = norm;
      });

      const idxCode     = Object.entries(headerMap).find(([, v]) => v === "code")?.[0];
      const idxName     = Object.entries(headerMap).find(([, v]) => v === "name")?.[0];
      const idxPrice    = Object.entries(headerMap).find(([, v]) => v === "price")?.[0];
      const idxCategory = Object.entries(headerMap).find(([, v]) => v === "category")?.[0];
      const idxImage    = Object.entries(headerMap).find(([, v]) => v === "image")?.[0];

      if (idxCode === undefined || idxName === undefined || idxPrice === undefined) {
        res.errors.push({
          row: 0,
          reason: `Cabeceras requeridas no encontradas. Esperadas: codigo, nombre, precio. Detectado: ${headerCells.join(" | ")}`,
        });
        setResult(res);
        return;
      }

      interface ParsedRow { rowNum: number; code: string; name: string; price: number; categoryName: string; image_url: string }
      const parsed: ParsedRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(sep).map(stripQuotes);
        const code = cells[Number(idxCode)]?.trim();
        const name = cells[Number(idxName)]?.trim();
        const priceRaw = cells[Number(idxPrice)]?.trim().replace(/[^\d.,-]/g, "").replace(",", ".");
        const price = Number(priceRaw);
        const categoryName = idxCategory !== undefined ? cells[Number(idxCategory)]?.trim() ?? "" : "";
        const imageUrl = idxImage !== undefined ? cells[Number(idxImage)]?.trim() ?? "" : "";

        if (!code || !name || !Number.isFinite(price)) {
          res.errors.push({ row: i + 1, reason: `Fila inválida (code="${code}", name="${name}", price="${priceRaw}")` });
          continue;
        }
        parsed.push({ rowNum: i + 1, code, name, price, categoryName, image_url: imageUrl });
      }

      setProgress("Resolviendo categorías…");
      const { data: existingCats } = await supabase.from("categories").select("id, name");
      const catMap = new Map<string, string>();
      (existingCats ?? []).forEach((c) => catMap.set(c.name.toLowerCase(), c.id));

      const newCatNames = [
        ...new Set(parsed.map((r) => r.categoryName).filter((n) => n && !catMap.has(n.toLowerCase()))),
      ];

      if (newCatNames.length > 0) {
        const { data: created, error: catErr } = await supabase
          .from("categories")
          .insert(newCatNames.map((name) => ({ name })))
          .select("id, name");
        if (catErr) {
          res.errors.push({ row: 0, reason: `Error creando categorías: ${catErr.message}` });
        } else {
          (created ?? []).forEach((c) => catMap.set(c.name.toLowerCase(), c.id));
        }
      }

      let productsWithImages = 0;
      const warnings: { row: number; reason: string }[] = [];

      const payloads = parsed.map((r) => {
        const payload: any = {
          code: r.code,
          name: r.name,
          price: r.price,
          category_id: catMap.get(r.categoryName.toLowerCase()) ?? null,
          active: true,
        };

        // Only include image_url if valid
        if (r.image_url) {
          if (isValidImageUrl(r.image_url)) {
            payload.image_url = r.image_url.trim();
            productsWithImages += 1;
          } else {
            warnings.push({ row: r.rowNum, reason: `URL de imagen inválida: "${r.image_url}"` });
          }
        }

        return payload;
      });

      const { data: existingProds } = await supabase.from("products").select("code");
      const existingCodes = new Set((existingProds ?? []).map((p) => p.code));

      const CHUNK = 100;
      for (let start = 0; start < payloads.length; start += CHUNK) {
        const chunk = payloads.slice(start, start + CHUNK);
        setProgress(`Importando ${start + 1}–${Math.min(start + CHUNK, payloads.length)} de ${payloads.length}…`);
        const { error } = await supabase.from("products").upsert(chunk, { onConflict: "code" });
        if (error) {
          res.errors.push({ row: start + 2, reason: `Lote ${start / CHUNK + 1}: ${error.message}` });
        } else {
          chunk.forEach((p) => {
            if (existingCodes.has(p.code)) res.updated += 1;
            else res.created += 1;
          });
        }
      }

      res.errors.push(...warnings);
      res.products_with_images = productsWithImages;
    } finally {
      setProgress("");
      setRunning(false);
      setResult(res);
    }
  };

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-ink-muted mb-3">
        Pega el contenido de tu Excel/CSV. Columnas esperadas (en cualquier orden):{" "}
        <code className="bg-cream-200 px-1.5 py-0.5 rounded text-ink-muted">codigo</code>,{" "}
        <code className="bg-cream-200 px-1.5 py-0.5 rounded text-ink-muted">nombre</code>,{" "}
        <code className="bg-cream-200 px-1.5 py-0.5 rounded text-ink-muted">precio</code>,{" "}
        <code className="bg-cream-200 px-1.5 py-0.5 rounded text-ink-muted">categoria</code> (opcional),{" "}
        <code className="bg-cream-200 px-1.5 py-0.5 rounded text-ink-muted">image_url</code> (opcional).{" "}
        Si un código ya existe, se actualiza. URLs deben empezar con http:// o https://.
      </p>

      <div className="flex items-center gap-3 mb-2">
        <label className="btn-secondary text-xs py-1.5 px-3 cursor-pointer">
          📂 Cargar archivo CSV
          <input
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => setText(ev.target?.result as string ?? "");
              reader.readAsText(file, "utf-8");
              e.target.value = "";
            }}
          />
        </label>
        {text && (
          <span className="text-xs text-ink-muted">
            {text.split(/\r?\n/).filter(Boolean).length - 1} filas cargadas
          </span>
        )}
      </div>
      <textarea
        className="input min-h-[240px] font-mono text-xs"
        placeholder={`codigo,nombre,precio,categoria,image_url\nL-A,Letra A,5000,Letras,https://ejemplo.com/imagen.jpg\nL-B,Letra B,5000,Letras,https://ejemplo.com/imagen2.jpg`}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <button
        className="btn-primary mt-3"
        onClick={runImport}
        disabled={running || !text.trim()}
      >
        {running ? "Importando..." : "Importar"}
      </button>
      {progress && <p className="text-sm text-ink-muted mt-2 italic">{progress}</p>}

      {result && (
        <div className="card p-4 mt-4">
          <h3 className="font-serif text-lg mb-3 text-ink">Resultado</h3>
          <p className="text-sm">✅ Creados: <strong>{result.created}</strong></p>
          <p className="text-sm">🔄 Actualizados: <strong>{result.updated}</strong></p>
          <p className="text-sm">📷 Con imagen: <strong>{result.products_with_images ?? 0}</strong></p>
          <p className="text-sm">⚠️ Errores: <strong>{result.errors.length}</strong></p>
          {result.errors.length > 0 && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-ink-muted">Ver detalle</summary>
              <ul className="mt-2 space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i}>Fila {e.row}: {e.reason}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab: Vendedores
// ═════════════════════════════════════════════════════════════════════════════

function CodeCell({ code }: { code: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="flex items-center gap-2">
      <span className="font-mono text-xs">{visible ? code : "••••"}</span>
      <button
        className="text-xs text-ink-muted hover:text-brand-darker underline"
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? "Ocultar" : "Ver"}
      </button>
    </span>
  );
}

function SellersTab() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Seller | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("sellers")
      .select("*")
      .order("name", { ascending: true });
    setSellers((data ?? []) as Seller[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (s: Seller) => {
    await supabase.from("sellers").update({ active: !s.active }).eq("id", s.id);
    load();
  };

  const remove = async (s: Seller) => {
    if (!confirm(`¿Eliminar al vendedor "${s.name}"?`)) return;
    await supabase.from("sellers").delete().eq("id", s.id);
    load();
  };

  if (loading)
    return <p className="font-serif italic text-ink-muted">Cargando…</p>;

  return (
    <div>
      <p className="text-sm text-ink-muted mb-4">
        Los vendedores se identifican con nombre y código al iniciar turno,
        cuando el login de vendedor está activo en Configuración.
      </p>
      <button
        className="btn-primary mb-4"
        onClick={() => {
          setEditing(null);
          setShowForm(true);
        }}
      >
        + Nuevo vendedor
      </button>

      {showForm && (
        <SellerForm
          seller={editing}
          onCancel={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream-100 text-left text-ink-muted text-xs uppercase tracking-widest">
            <tr>
              <th className="p-3">Nombre</th>
              <th className="p-3">Código</th>
              <th className="p-3">Activo</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {sellers.map((s) => (
              <tr key={s.id} className="border-t border-cream-300/50">
                <td className="p-3 font-medium">{s.name}</td>
                <td className="p-3"><CodeCell code={s.code} /></td>
                <td className="p-3">
                  <button
                    onClick={() => toggleActive(s)}
                    className={`px-2 py-1 rounded text-xs ${
                      s.active
                        ? "bg-brand/10 text-brand-darker"
                        : "bg-cream-200 text-ink-light"
                    }`}
                  >
                    {s.active ? "Sí" : "No"}
                  </button>
                </td>
                <td className="p-3 text-right">
                  <button
                    className="text-brand mr-2"
                    onClick={() => { setEditing(s); setShowForm(true); }}
                  >
                    Editar
                  </button>
                  <button className="text-red-700" onClick={() => remove(s)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {sellers.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-ink-light">
                  Sin vendedores creados aún.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SellerForm({
  seller,
  onCancel,
  onSaved,
}: {
  seller: Seller | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(seller?.name ?? "");
  const [code, setCode] = useState(seller?.code ?? "");
  const [active, setActive] = useState(seller?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const payload = { name: name.trim(), code: code.trim(), active };
    const { error: err } = seller
      ? await supabase.from("sellers").update(payload).eq("id", seller.id)
      : await supabase.from("sellers").insert(payload);
    setSaving(false);
    if (err) setError(err.message);
    else onSaved();
  };

  return (
    <div className="card-elevated p-5 mb-4 border-brand/40 border">
      <h3 className="font-serif text-lg mb-4 text-ink">
        {seller ? "Editar vendedor" : "Nuevo vendedor"}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          className="input"
          placeholder="Nombre (ej: María)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <input
          className="input font-mono"
          placeholder="Código (ej: 4321)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Activo
        </label>
      </div>
      {error && <p className="text-red-700 text-sm mt-2">{error}</p>}
      <div className="flex gap-2 mt-4">
        <button
          className="btn-primary"
          onClick={save}
          disabled={saving || !name.trim() || !code.trim()}
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button className="btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
