/**
 * upload-images.mjs
 *
 * QUÉ HACE ESTE SCRIPT:
 * ---------------------
 * 1. Descomprime el zip de imágenes 2026
 * 2. Sube cada imagen a Supabase Storage (bucket: product-images)
 * 3. Actualiza image_url en la tabla products solo si el producto existe
 *    Y no tiene imagen aún (no pisa las URLs de pelgyteinspira.com)
 *
 * CÓMO CORRERLO:
 * --------------
 * node scripts/upload-images.mjs
 *
 * REQUISITOS:
 * -----------
 * - El zip debe estar en: ~/Downloads/2026-20260530T200544Z-3-001.zip
 * - Las credenciales de Supabase en .env.local
 */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, basename, extname } from "path";
import { tmpdir } from "os";

// ─── Config ──────────────────────────────────────────────────────────────────

const ZIP_PATH = `${process.env.HOME}/Downloads/2026-20260530T200544Z-3-001.zip`;
const EXTRACT_DIR = join(tmpdir(), "pelgy-images-2026");
const BUCKET = "product-images";
const STORAGE_FOLDER = "products";

// Leer credenciales desde .env.local
function loadEnv() {
  try {
    const content = readFileSync(".env.local", "utf8");
    const vars = {};
    for (const line of content.split("\n")) {
      const match = line.match(/^([^#=]+)=(.+)$/);
      if (match) vars[match[1].trim()] = match[2].trim();
    }
    return vars;
  } catch {
    return {};
  }
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ No se encontraron credenciales en .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Busca recursivamente todos los archivos de imagen en un directorio
function findImages(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...findImages(full));
    } else if (/\.(jpg|jpeg|png|webp)$/i.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🗜️  Descomprimiendo imágenes…");
  try {
    execSync(`rm -rf "${EXTRACT_DIR}" && unzip -q "${ZIP_PATH}" -d "${EXTRACT_DIR}"`);
  } catch (err) {
    console.error("❌ Error al descomprimir:", err.message);
    process.exit(1);
  }

  const images = findImages(EXTRACT_DIR);
  console.log(`📸 ${images.length} imágenes encontradas\n`);

  // Cargar todos los productos de Supabase para cruzar por SKU
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, code, image_url");

  if (prodErr) {
    console.error("❌ Error al cargar productos:", prodErr.message);
    process.exit(1);
  }

  // Índice: code → { id, image_url }
  const prodIndex = new Map(products.map(p => [p.code.toLowerCase(), p]));
  console.log(`📦 ${products.length} productos en Supabase\n`);

  let uploaded = 0;
  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  const errors = [];

  for (const imgPath of images) {
    const fileName = basename(imgPath);
    const sku = basename(fileName, extname(fileName)); // quitar extensión → SKU
    const prod = prodIndex.get(sku.toLowerCase());

    if (!prod) {
      notFound++;
      console.log(`  ⚠️  Sin producto: ${sku}`);
      continue;
    }

    if (prod.image_url) {
      skipped++;
      continue; // ya tiene imagen — no pisar
    }

    // Subir a Supabase Storage
    const storagePath = `${STORAGE_FOLDER}/${fileName.toLowerCase()}`;
    const fileBuffer = readFileSync(imgPath);
    const contentType = /\.png$/i.test(fileName) ? "image/png"
      : /\.webp$/i.test(fileName) ? "image/webp"
      : "image/jpeg";

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, { contentType, upsert: true });

    if (uploadErr) {
      errors.push({ sku, reason: uploadErr.message });
      console.log(`  ❌ ${sku}: ${uploadErr.message}`);
      continue;
    }

    uploaded++;

    // Obtener URL pública
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    // Actualizar image_url en products
    const { error: updateErr } = await supabase
      .from("products")
      .update({ image_url: publicUrl })
      .eq("id", prod.id);

    if (updateErr) {
      errors.push({ sku, reason: updateErr.message });
      console.log(`  ❌ UPDATE ${sku}: ${updateErr.message}`);
    } else {
      updated++;
      process.stdout.write(`  ✅ ${sku}\n`);
    }

    await sleep(100); // pequeña pausa para no saturar la API
  }

  console.log("\n─────────────────────────────────────────");
  console.log(`✅ Subidas:         ${uploaded}`);
  console.log(`🔄 Actualizadas:   ${updated}`);
  console.log(`⏭️  Ya tenían imagen: ${skipped}`);
  console.log(`🔍 SKU sin producto: ${notFound}`);
  console.log(`❌ Errores:         ${errors.length}`);

  if (errors.length > 0) {
    console.log("\nDetalle de errores:");
    errors.forEach(e => console.log(`  [${e.sku}] ${e.reason}`));
  }

  // Limpiar carpeta temporal
  execSync(`rm -rf "${EXTRACT_DIR}"`);
  console.log("\n🧹 Carpeta temporal eliminada");
}

main().catch(console.error);
