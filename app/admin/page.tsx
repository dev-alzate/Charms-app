"use client";

import { signOut } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Category,
  PAYMENT_LABELS,
  Product,
  Sale,
  Seller,
  supabase,
} from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/format";

type TabKey = "config" | "products" | "categories" | "sales" | "import" | "sellers";

const TABS: { key: TabKey; label: string }[] = [
  { key: "config", label: "Configuración" },
  { key: "products", label: "Productos" },
  { key: "categories", label: "Categorías" },
  { key: "sales", label: "Ventas" },
  { key: "import", label: "Importar" },
  { key: "sellers", label: "Vendedores" },
];

export default function AdminPage() {
  const [tab, setTab] = useState<TabKey>("config");

  return (
    <main className="min-h-screen bg-cream-100">
      <header className="sticky top-0 z-10 bg-cream-50/95 backdrop-blur border-b border-cream-300">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-ink-muted text-sm hover:text-brand-darker"
          >
            ← Inicio
          </button>
          <h1 className="font-serif text-xl tracking-wide text-ink flex-1">
            Administración
          </h1>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-ink-muted hover:text-red-700 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
        <nav className="overflow-x-auto scroll-x-hidden border-t border-cream-300/60">
          <div className="max-w-5xl mx-auto flex gap-1 px-2 min-w-max">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-5 py-3 text-sm whitespace-nowrap border-b-2 tracking-wide transition-colors ${
                  tab === t.key
                    ? "border-brand text-brand-darker"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <section className="max-w-5xl mx-auto p-4">
        {tab === "config" && <ConfigTab />}
        {tab === "products" && <ProductsTab />}
        {tab === "categories" && <CategoriesTab />}
        {tab === "sales" && <SalesTab />}
        {tab === "import" && <ImportTab />}
        {tab === "sellers" && <SellersTab />}
      </section>
    </main>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Tab: Configuración
// ═════════════════════════════════════════════════════════════════════════

function ConfigTab() {
  const [armadorPhone, setArmadorPhone] = useState("");
  const [requireSellerLogin, setRequireSellerLogin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSellerLogin, setSavingSellerLogin] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("settings")
        .select("*")
        .in("key", ["armador_whatsapp", "require_seller_login"]);
      const rows = (data ?? []) as { key: string; value: string }[];
      setArmadorPhone(
        rows.find((r) => r.key === "armador_whatsapp")?.value ?? ""
      );
      setRequireSellerLogin(
        rows.find((r) => r.key === "require_seller_login")?.value === "true"
      );
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from("settings")
      .upsert({ key: "armador_whatsapp", value: armadorPhone.trim() });
    setSaving(false);
    setMsg(error ? `Error: ${error.message}` : "Guardado correctamente");
  };

  const saveSellerLogin = async (val: boolean) => {
    setSavingSellerLogin(true);
    await supabase
      .from("settings")
      .upsert({ key: "require_seller_login", value: val ? "true" : "false" });
    setSavingSellerLogin(false);
    setRequireSellerLogin(val);
  };

  if (loading)
    return <p className="font-serif italic text-ink-muted">Cargando…</p>;

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      {/* Armador WhatsApp */}
      <div className="card p-5">
        <h2 className="display-md mb-2">WhatsApp del armador</h2>
        <p className="text-sm text-ink-muted mb-4">
          Número del celular al que se enviarán los pedidos para ensamblar.
          Formato: con código de país, sin espacios. Ej:{" "}
          <code>573001234567</code>
        </p>
        <input
          className="input mb-4"
          type="tel"
          inputMode="numeric"
          placeholder="573001234567"
          value={armadorPhone}
          onChange={(e) => setArmadorPhone(e.target.value)}
        />
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
        {msg && (
          <p className="text-sm mt-3 text-brand-darker italic">{msg}</p>
        )}
      </div>

      {/* Login de vendedores */}
      <div className="card p-5">
        <h2 className="display-md mb-2">Login de vendedores</h2>
        <p className="text-sm text-ink-muted mb-4">
          Cuando está activo, los vendedores deben ingresar su nombre y código
          al iniciar turno en la pantalla de venta. Gestiona los vendedores en
          la pestaña <strong>Vendedores</strong>.
        </p>
        <div
          className={`flex items-center gap-3 cursor-pointer select-none w-fit ${
            savingSellerLogin ? "opacity-50 pointer-events-none" : ""
          }`}
          onClick={() => saveSellerLogin(!requireSellerLogin)}
        >
          <div
            className={`relative w-11 h-6 rounded-full transition-colors ${
              requireSellerLogin ? "bg-brand" : "bg-cream-300"
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                requireSellerLogin ? "translate-x-5" : "translate-x-[2px]"
              }`}
            />
          </div>
          <span className="text-sm text-ink">
            Requerir login de vendedor en pantalla de venta
          </span>
        </div>
        {savingSellerLogin && (
          <p className="text-xs text-ink-muted mt-2 italic">Guardando…</p>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Tab: Productos
// ═════════════════════════════════════════════════════════════════════════

function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<string | "ALL">("ALL");
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);

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

  const visible = useMemo(
    () =>
      filterCat === "ALL"
        ? products
        : products.filter((p) => p.category_id === filterCat),
    [products, filterCat]
  );

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
                      <span className="text-ink-light text-xs">
                        Sin categoría
                      </span>
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
                    <button
                      className="text-red-700"
                      onClick={() => remove(p)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-ink-light">
                  Sin productos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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

  // ── Imagen ──────────────────────────────────────────────────────────────
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    product?.image_url ?? null
  );
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);

    let image_url = product?.image_url ?? null;

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
      image_url = urlData.publicUrl;
      setUploadingImage(false);
    }

    if (!imagePreview && !imageFile) {
      image_url = null;
    }

    const payload = {
      code: code.trim(),
      name: name.trim(),
      price: Number(price),
      category_id: categoryId || null,
      image_url,
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

      {/* Foto del producto */}
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
          disabled={saving || uploadingImage || !code.trim() || !name.trim() || !price}
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

// ═════════════════════════════════════════════════════════════════════════
// Tab: Categorías
// ═════════════════════════════════════════════════════════════════════════

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
    if (
      !confirm(
        `¿Eliminar "${c.name}"? Los productos quedarán sin categoría.`
      )
    )
      return;
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
                  <button
                    className="text-red-700"
                    onClick={() => remove(c)}
                  >
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

// ═════════════════════════════════════════════════════════════════════════
// Tab: Ventas
// ═════════════════════════════════════════════════════════════════════════

function SalesTab() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("sales")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setSales((data ?? []) as Sale[]);
      setLoading(false);
    })();
  }, []);

  const todaySummary = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const todays = sales.filter((s) => new Date(s.created_at) >= start);
    const total = todays.reduce((sum, s) => sum + Number(s.total), 0);
    return { count: todays.length, total };
  }, [sales]);

  if (loading)
    return <p className="font-serif italic text-ink-muted">Cargando…</p>;

  return (
    <div>
      <div className="card p-6 mb-4 flex flex-wrap gap-10">
        <div>
          <div className="eyebrow mb-1">Ventas hoy</div>
          <div className="font-serif text-4xl text-ink">
            {todaySummary.count}
          </div>
        </div>
        <div>
          <div className="eyebrow mb-1">Ingresos hoy</div>
          <div className="font-serif text-4xl text-brand-darker">
            {formatCurrency(todaySummary.total)}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream-100 text-left text-ink-muted text-xs uppercase tracking-widest">
            <tr>
              <th className="p-3">Factura</th>
              <th className="p-3">Ticket</th>
              <th className="p-3">Fecha</th>
              <th className="p-3">Atendió</th>
              <th className="p-3">Pago</th>
              <th className="p-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-t border-cream-300/50">
                <td className="p-3 font-mono text-xs">{s.invoice_number}</td>
                <td className="p-3">#{s.ticket_number}</td>
                <td className="p-3">{formatDate(s.created_at)}</td>
                <td className="p-3">{s.identifier_name ?? "—"}</td>
                <td className="p-3">{PAYMENT_LABELS[s.payment_method]}</td>
                <td className="p-3 text-right font-semibold">
                  {formatCurrency(Number(s.total))}
                </td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-ink-light">
                  Aún no hay ventas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-light mt-3">
        Se muestran las últimas 100 ventas. Para reportes avanzados, exporta
        desde Supabase.
      </p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Tab: Importar
// ═════════════════════════════════════════════════════════════════════════

const HEADER_ALIASES: Record<string, string[]> = {
  code: ["code", "codigo", "código", "ref", "referencia", "sku"],
  name: ["name", "nombre", "producto", "descripcion", "descripción"],
  price: ["price", "precio", "valor", "costo"],
  category: ["category", "categoria", "categoría", "cat"],
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

interface ImportResult {
  created: number;
  updated: number;
  errors: { row: number; reason: string }[];
}

function ImportTab() {
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const runImport = async () => {
    setRunning(true);
    setResult(null);
    const res: ImportResult = { created: 0, updated: 0, errors: [] };

    try {
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (lines.length < 2) {
        res.errors.push({
          row: 0,
          reason: "Se necesitan al menos cabecera + 1 fila",
        });
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

      const idxCode = Object.entries(headerMap).find(([, v]) => v === "code")?.[0];
      const idxName = Object.entries(headerMap).find(([, v]) => v === "name")?.[0];
      const idxPrice = Object.entries(headerMap).find(([, v]) => v === "price")?.[0];
      const idxCategory = Object.entries(headerMap).find(([, v]) => v === "category")?.[0];

      if (idxCode === undefined || idxName === undefined || idxPrice === undefined) {
        res.errors.push({
          row: 0,
          reason: `Cabeceras requeridas no encontradas. Esperadas: codigo, nombre, precio (categoria opcional). Detectado: ${headerCells.join(" | ")}`,
        });
        setResult(res);
        return;
      }

      // Cache de categorías existentes
      const { data: existingCats } = await supabase
        .from("categories")
        .select("id, name");
      const catMap = new Map<string, string>();
      (existingCats ?? []).forEach((c) =>
        catMap.set(c.name.toLowerCase(), c.id)
      );

      // Cache de productos existentes (por code)
      const { data: existingProds } = await supabase
        .from("products")
        .select("id, code");
      const prodMap = new Map<string, string>();
      (existingProds ?? []).forEach((p) =>
        prodMap.set(p.code, p.id)
      );

      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(sep).map(stripQuotes);
        const code = cells[Number(idxCode)]?.trim();
        const name = cells[Number(idxName)]?.trim();
        const priceRaw = cells[Number(idxPrice)]?.trim().replace(/[^\d.,-]/g, "").replace(",", ".");
        const price = Number(priceRaw);
        const categoryName = idxCategory !== undefined ? cells[Number(idxCategory)]?.trim() : "";

        if (!code || !name || !Number.isFinite(price)) {
          res.errors.push({
            row: i + 1,
            reason: `Fila inválida (code="${code}", name="${name}", price="${priceRaw}")`,
          });
          continue;
        }

        // Resolver categoría: crear si no existe
        let category_id: string | null = null;
        if (categoryName) {
          const lookup = catMap.get(categoryName.toLowerCase());
          if (lookup) {
            category_id = lookup;
          } else {
            const { data: newCat, error: catErr } = await supabase
              .from("categories")
              .insert({ name: categoryName })
              .select("id")
              .single();
            if (catErr || !newCat) {
              res.errors.push({
                row: i + 1,
                reason: `No se pudo crear categoría "${categoryName}": ${catErr?.message ?? "error desconocido"}`,
              });
              continue;
            }
            category_id = newCat.id;
            catMap.set(categoryName.toLowerCase(), newCat.id);
          }
        }

        const payload = { code, name, price, category_id, active: true };
        const existingId = prodMap.get(code);
        if (existingId) {
          const { error } = await supabase
            .from("products")
            .update(payload)
            .eq("id", existingId);
          if (error) {
            res.errors.push({ row: i + 1, reason: error.message });
          } else {
            res.updated += 1;
          }
        } else {
          const { error, data } = await supabase
            .from("products")
            .insert(payload)
            .select("id")
            .single();
          if (error) {
            res.errors.push({ row: i + 1, reason: error.message });
          } else {
            res.created += 1;
            if (data) prodMap.set(code, data.id);
          }
        }
      }
    } finally {
      setRunning(false);
      setResult(res);
    }
  };

  return (
    <div className="max-w-3xl">
      <h2 className="display-md mb-2">Importar productos</h2>
      <p className="text-sm text-ink-muted mb-3">
        Pega el contenido de tu Excel/CSV. Columnas esperadas (en cualquier
        orden):{" "}
        <code className="bg-cream-200 px-1.5 py-0.5 rounded text-ink-muted">codigo</code>,{" "}
        <code className="bg-cream-200 px-1.5 py-0.5 rounded text-ink-muted">nombre</code>,{" "}
        <code className="bg-cream-200 px-1.5 py-0.5 rounded text-ink-muted">precio</code>,{" "}
        <code className="bg-cream-200 px-1.5 py-0.5 rounded text-ink-muted">categoria</code>{" "}
        (opcional).
        <br />
        Si una categoría no existe, se crea automáticamente. Si un código ya
        existe, se actualiza.
      </p>

      <textarea
        className="input min-h-[240px] font-mono text-xs"
        placeholder={`codigo,nombre,precio,categoria\nL-A,Letra A,5000,Letras\nL-B,Letra B,5000,Letras`}
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

      {result && (
        <div className="card p-4 mt-4">
          <h3 className="font-serif text-lg mb-3 text-ink">Resultado</h3>
          <p className="text-sm">
            ✅ Creados: <strong>{result.created}</strong>
          </p>
          <p className="text-sm">
            🔄 Actualizados: <strong>{result.updated}</strong>
          </p>
          <p className="text-sm">
            ⚠️ Errores: <strong>{result.errors.length}</strong>
          </p>
          {result.errors.length > 0 && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-ink-muted">
                Ver detalle
              </summary>
              <ul className="mt-2 space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    Fila {e.row}: {e.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Tab: Vendedores
// ═════════════════════════════════════════════════════════════════════════

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
    await supabase
      .from("sellers")
      .update({ active: !s.active })
      .eq("id", s.id);
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
                <td className="p-3">
                  <CodeCell code={s.code} />
                </td>
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
                    onClick={() => {
                      setEditing(s);
                      setShowForm(true);
                    }}
                  >
                    Editar
                  </button>
                  <button
                    className="text-red-700"
                    onClick={() => remove(s)}
                  >
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
