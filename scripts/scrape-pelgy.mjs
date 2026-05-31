/**
 * scrape-pelgy.mjs
 *
 * QUÉ HACE ESTE SCRIPT:
 * ---------------------
 * 1. Llama a la API pública de WooCommerce de pelgyteinspira.com
 * 2. Descarga TODOS los productos de las categorías de Dijes/Charms
 * 3. Genera dos archivos:
 *    - products.csv   → para importar en /admin → "Importar"
 *    - images.sql     → para actualizar image_url en Supabase con un solo comando
 *
 * POR QUÉ FUNCIONA SIN CONTRASEÑA:
 * ----------------------------------
 * WooCommerce tiene una API pública (/wp-json/wc/store/v1/products)
 * que devuelve los productos publicados sin necesitar autenticación.
 * Es como leer la tienda online pero en formato de datos (JSON) en lugar de HTML.
 *
 * CÓMO CORRERLO:
 * --------------
 * node scripts/scrape-pelgy.mjs
 */

const BASE_URL = "https://pelgyteinspira.com/wp-json/wc/store/v1/products";
const PER_PAGE = 100; // máximo permitido por la API

// Categorías a descargar: Dijes (2354) incluye todas las subcategorías
// Usamos la categoría padre que agrupa todo
const CATEGORY_ID = 2354; // "Dijes" - 922 productos

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanSku(raw) {
  // Normaliza el SKU: quita "Ref.", "Ref:", "Ref-", "ref - ", ": ", etc.
  return raw
    .replace(/^ref[.:]\s*[-–]?\s*/i, "")   // "Ref: XXX", "Ref. XXX"
    .replace(/^ref\s*[-–]\s*/i, "")        // "Ref - XXX", "Ref–XXX"
    .replace(/^ref\s+/i, "")               // "Ref XXX" (solo espacio)
    .replace(/^:\s*/, "")                  // ": XXX" (resto de casos)
    .trim();
}

function cleanPrice(raw) {
  // Convierte "$ 5.500" o "5500" a número entero
  return parseInt(String(raw).replace(/[^\d]/g, ""), 10) || 0;
}

function cleanName(raw) {
  // Decodifica entidades HTML básicas y recorta espacios
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#8211;/g, "–")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#215;/g, "x")      // × (por) → "x"
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code))) // resto de entidades numéricas
    .replace(/\s+/g, " ")
    .trim();
}

function getBestImage(images) {
  if (!images || images.length === 0) return "";
  // Preferir imagen con src que no sea placeholder
  const real = images.find(img => img.src && !img.src.includes("placeholder"));
  return real ? real.src : images[0]?.src || "";
}

function getCategory(categories) {
  if (!categories || categories.length === 0) return "";
  // Priorizar la categoría más específica (hoja del árbol)
  // Filtrar categorías genéricas
  const skip = ["dijes", "charms", "insumos para bisutería", "lo ultimo", "nuevo", "tendencia",
    "diy para bisutería", "pelgy bisuteria"];
  const specific = categories.filter(c =>
    !skip.some(s => c.name.toLowerCase().includes(s))
  );
  if (specific.length > 0) return specific[0].name;
  return categories[0].name;
}

// ─── Fetch con reintentos ───────────────────────────────────────────────────

async function fetchPage(page) {
  const url = `${BASE_URL}?category=${CATEGORY_ID}&per_page=${PER_PAGE}&page=${page}&orderby=date&order=asc`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const total = parseInt(res.headers.get("x-wp-total") || "0", 10);
      const totalPages = parseInt(res.headers.get("x-wp-totalpages") || "1", 10);
      return { data, total, totalPages };
    } catch (err) {
      console.error(`  ⚠️  Página ${page} intento ${attempt} falló: ${err.message}`);
      if (attempt < 3) await sleep(2000);
    }
  }
  return { data: [], total: 0, totalPages: 0 };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔍 Scraping productos de pelgyteinspira.com...\n");

  const products = [];
  const seen = new Set(); // evitar duplicados por SKU

  // Página 1 para saber el total
  const first = await fetchPage(1);
  const totalPages = first.totalPages;
  console.log(`📦 Total productos: ${first.total} | Páginas: ${totalPages}`);

  // Procesar página 1
  for (const p of first.data) {
    const sku = cleanSku(p.sku || "");
    if (!sku || seen.has(sku)) continue;
    seen.add(sku);
    products.push({
      code: sku,
      name: cleanName(p.name || ""),
      price: cleanPrice(p.prices?.price || p.price || 0),
      category: getCategory(p.categories || []),
      image_url: getBestImage(p.images || []),
    });
  }

  // Páginas restantes
  for (let page = 2; page <= totalPages; page++) {
    process.stdout.write(`  Página ${page}/${totalPages}...`);
    await sleep(300); // respetar el servidor
    const { data } = await fetchPage(page);
    let added = 0;
    for (const p of data) {
      const sku = cleanSku(p.sku || "");
      if (!sku || seen.has(sku)) continue;
      seen.add(sku);
      products.push({
        code: sku,
        name: cleanName(p.name || ""),
        price: cleanPrice(p.prices?.price || p.price || 0),
        category: getCategory(p.categories || []),
        image_url: getBestImage(p.images || []),
      });
      added++;
    }
    process.stdout.write(` +${added} productos\n`);
  }

  console.log(`\n✅ Total productos únicos extraídos: ${products.length}`);

  // ─── Generar products.csv ──────────────────────────────────────────────
  const csvLines = ["codigo,nombre,precio,categoria"];
  for (const p of products) {
    const row = [
      `"${p.code.replace(/"/g, '""')}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.price}"`,
      `"${p.category.replace(/"/g, '""')}"`,
    ].join(",");
    csvLines.push(row);
  }

  const { writeFileSync } = await import("fs");

  writeFileSync("scripts/products.csv", csvLines.join("\n"), "utf8");
  console.log(`📄 CSV generado: scripts/products.csv (${csvLines.length - 1} filas)`);

  // ─── Generar images.sql ────────────────────────────────────────────────
  // SQL para actualizar image_url en Supabase después de importar los productos
  const sqlLines = [
    "-- Actualizar image_url en Supabase después de importar products.csv",
    "-- Corre este SQL en el SQL Editor de Supabase",
    "",
  ];
  for (const p of products) {
    if (!p.image_url) continue;
    const safeCode = p.code.replace(/'/g, "''");
    const safeUrl = p.image_url.replace(/'/g, "''");
    sqlLines.push(`UPDATE products SET image_url = '${safeUrl}' WHERE code = '${safeCode}';`);
  }
  writeFileSync("scripts/images.sql", sqlLines.join("\n"), "utf8");
  console.log(`🖼️  SQL de imágenes generado: scripts/images.sql (${sqlLines.length - 3} updates)`);

  // ─── Resumen de categorías encontradas ────────────────────────────────
  const catCounts = {};
  for (const p of products) {
    catCounts[p.category] = (catCounts[p.category] || 0) + 1;
  }
  console.log("\n📂 Categorías encontradas:");
  Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => console.log(`   ${cat}: ${count} productos`));

  // ─── Muestra de 5 productos ────────────────────────────────────────────
  console.log("\n🔎 Muestra de primeros 5 productos:");
  products.slice(0, 5).forEach(p => {
    console.log(`  [${p.code}] ${p.name} | $${p.price.toLocaleString()} | ${p.category}`);
    if (p.image_url) console.log(`         → ${p.image_url}`);
  });
}

main().catch(console.error);
