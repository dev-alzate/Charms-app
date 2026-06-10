# PELGY POS — Manual Técnico

> Next.js 14 · Supabase · Vercel · TypeScript  
> Producción: `pelgystore.vercel.app`

---

## 01. Descripción general

PELGY POS es un sistema de punto de venta web diseñado para una joyería de charms personalizada. Permite a los vendedores registrar ventas desde cualquier dispositivo con navegador, genera facturas en PDF formato recibo térmico (80mm), y le da al administrador control total sobre el catálogo, ventas, vendedores y configuración — todo sincronizado en tiempo real con Supabase.

| | |
|---|---|
| Rutas públicas | `/` · `/sale` · `/login` |
| Panel admin | 7 tabs: Inicio, Configuración, Productos, Categorías, Ventas, Importar, Vendedores |
| Base de datos | Supabase PostgreSQL — 6 tablas |
| Storage buckets | `product-images` · `sale-invoices` |

---

## 02. Autenticación

### Administrador
Accede a `/login` con:
- **Correo + contraseña** — variables de entorno `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- **PIN de admin** — variable `ADMIN_PIN`

Sesión JWT gestionada por NextAuth.js. Duración: 8 horas (un turno de feria).

### Vendedor
Accede a `/sale` con nombre + código PIN creado desde el panel admin.  
Si el login de vendedores está desactivado desde Configuración, entra directo sin identificación.

> Ni el admin ni los vendedores usan Supabase Auth. Todos hacen llamadas a Supabase como usuario `anon`.

---

## 03. Flujo de venta

1. **Identificación del vendedor** — si el login está activo, ingresa nombre y PIN. La pantalla pide confirmación antes de continuar.

2. **Catálogo de productos** — grilla visual con fotos, filtro por categorías, búsqueda en tiempo real por nombre/código/categoría/precio. Scroll infinito (carga de 30 en 30). Vista de grilla o lista.

3. **Carrito y pago** — el vendedor agrega productos, ajusta cantidades, ingresa nombre/teléfono del cliente (opcional), y selecciona método de pago: Efectivo, Transferencia o Datafono.

4. **Registro en Supabase + PDF automático** — la venta se inserta en la tabla `sales`. Los triggers de Postgres asignan automáticamente el número de factura (`F-2026-XXXX`) y el ticket del día. Luego el PDF se genera en el cliente con jsPDF y se sube al bucket `sale-invoices`. La URL pública se guarda en `sales.pdf_url`.

5. **Pantalla de éxito** — muestra factura, ticket, total y método de pago. Botones para:
   - Descargar PDF
   - Enviar al cliente por WhatsApp
   - Iniciar la siguiente venta

### Modo offline
Si no hay internet:
- El catálogo se sirve desde `localStorage` (caché guardado en la última conexión).
- La venta se guarda localmente como pendiente.
- Se sincroniza automáticamente con Supabase cuando vuelve la conexión.

---

## 04. Panel de administración (`/admin`)

### Configuración
- Activa/desactiva métodos de pago (Efectivo, Transferencia, Datafono).
- Habilita o deshabilita el login de vendedores.

### Productos
- Listado con búsqueda en tiempo real por código o nombre.
- Paginación de 20 productos por página.
- CRUD completo: crear, editar, eliminar, activar/desactivar.
- Imagen: subir foto desde el PC **o** pegar una URL externa.
- En edición, si no se cambia la imagen, se conserva la existente.

### Categorías
- CRUD de categorías con nombre y color personalizado (hex).
- Se pueden activar o desactivar.

### Ventas
- Resumen del día: conteo de ventas e ingresos totales.
- Tabla con scroll infinito (carga de 30 ventas por lote).
- Filtros: buscar por número de factura, fecha desde, fecha hasta.
- Columna PDF: botón "Ver PDF" si la venta tiene PDF guardado, "Sin PDF" si no.

### Importar
Carga masiva de productos por CSV o Excel. Ver sección 06.

### Vendedores
- CRUD de vendedores con nombre y código PIN.
- El código se oculta por defecto con botón "Ver/Ocultar".
- Se pueden activar o desactivar.

---

## 05. Base de datos

### Tablas

#### `products`
```
id · code (único) · name · price · category_id · image_url · active · display_order · created_at · updated_at
```

#### `sales`
```
id · invoice_number · ticket_number · items (jsonb) · total · payment_method
customer_name · customer_phone · identifier_name · notes · pdf_url · created_at
```

#### `categories`
```
id · name (único) · display_order · color (hex) · active · created_at
```

#### `sellers`
```
id · name · code (PIN, único) · active · created_at
```

#### `payment_methods`
```
id · key · label · active · display_order
```

#### `settings`
```
key · value · updated_at
Ejemplo: require_seller_login → "true" / "false"
```

### Triggers automáticos (Postgres)

| Trigger | Función |
|---|---|
| `trg_set_invoice_number` | Al insertar una venta, asigna `F-YYYY-XXXX` y el número de ticket diario |
| `trg_products_updated_at` | Actualiza `updated_at` en cada modificación de un producto |

### Numeración de facturas

- Formato: `F-2026-0001` (secuencia anual, 4 dígitos).
- El ticket se resetea cada día: `#1`, `#2`, `#3`...
- Ambos se calculan automáticamente en Postgres al insertar la venta.

### RLS (Row Level Security)
Habilitado en todas las tablas, con políticas `FOR ALL` para el rol `anon`. El sistema no usa autenticación de Supabase.

---

## 06. Importador CSV

Acceso: Admin → Importar.

### Formatos aceptados

**Formato propio:**
```csv
codigo,nombre,precio,categoria,image_url
REF-001,"Dije corazón",5000,Dijes,https://ejemplo.com/imagen.jpg
```

**Formato WooCommerce (mapeo automático):**
```csv
SKU,Nombre,Precio normal,Imágenes
REF-001,"Dije corazón",5000,https://ejemplo.com/imagen.jpg
```

### Reglas de comportamiento

- Si el código ya existe → actualiza nombre, precio, categoría e imagen.
- Si el código no existe → crea el producto.
- URL de imagen inválida (sin `http://` o `https://`) → importa el producto sin imagen, reporta advertencia.
- Si la imagen viene vacía en una actualización → conserva la imagen existente.
- Categoría nueva → se crea automáticamente.
- Categoría vacía o ausente → `category_id = null`, sin error.
- El resultado final muestra: creados, actualizados, con imagen, advertencias.

### Aliases de columnas aceptados

| Campo | Aliases reconocidos |
|---|---|
| Código | `code`, `codigo`, `código`, `ref`, `referencia`, `sku`, `SKU` |
| Nombre | `name`, `nombre`, `producto`, `Nombre` |
| Precio | `price`, `precio`, `valor`, `costo`, `Precio normal` |
| Categoría | `category`, `categoria`, `categoría`, `cat` |
| Imagen | `image`, `image_url`, `imagen`, `imagenes`, `imágenes`, `url_imagen`, `images`, `Imágenes` |

---

## 07. PDF de facturas

- Generado en el cliente con `jsPDF` + `jspdf-autotable`.
- Formato: 80mm de ancho (recibo térmico).
- Contenido: nombre del negocio, NIT, teléfono, dirección, número de factura, ticket, fecha, vendedor, cliente, tabla de productos, total, método de pago.
- Al completar la venta se sube automáticamente al bucket `sale-invoices`.
- La URL pública se guarda en `sales.pdf_url`.
- El botón "Descargar PDF" de la pantalla de éxito sigue funcionando igual (descarga local inmediata).

---

## 08. Supabase Storage

### Buckets

| Bucket | Contenido | Path |
|---|---|---|
| `product-images` | Fotos de productos | `products/{code}.jpg` |
| `sale-invoices` | PDFs de facturas | `invoices/F-2026-XXXX.pdf` |

Ambos buckets son **públicos**.

### Políticas necesarias en `sale-invoices`

El bucket requiere 2 políticas para el rol `anon`:

```sql
CREATE POLICY "Allow anon insert invoices"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'sale-invoices');

CREATE POLICY "Allow public read invoices"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'sale-invoices');
```

---

## 09. Scripts de scraping

### `scripts/scrape-pelgy.mjs`

Llama a la API pública de WooCommerce de `pelgyteinspira.com` y descarga todos los productos de la categoría Dijes (ID 2354, ~922 productos).

Genera:
- `scripts/products.csv` — listo para importar en Admin → Importar.

```bash
node scripts/scrape-pelgy.mjs
```

### `scripts/upload-images.mjs`

Toma un ZIP de imágenes de la carpeta Descargas, las sube al bucket `product-images` de Supabase y actualiza `products.image_url` haciendo match por SKU.

```bash
node scripts/upload-images.mjs
```

---

## 10. Variables de entorno

Definidas en `.env.local` (local) y en Vercel (producción).

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anon de Supabase |
| `ADMIN_EMAIL` | Correo del administrador |
| `ADMIN_PASSWORD` | Contraseña del administrador |
| `ADMIN_PIN` | PIN alternativo de acceso admin |
| `NEXTAUTH_SECRET` | Secreto para firmar tokens JWT |
| `NEXT_PUBLIC_BUSINESS_NAME` | Nombre del negocio (aparece en el PDF) |
| `NEXT_PUBLIC_BUSINESS_NIT` | NIT del negocio (aparece en el PDF) |
| `NEXT_PUBLIC_BUSINESS_PHONE` | Teléfono (aparece en el PDF) |
| `NEXT_PUBLIC_BUSINESS_ADDRESS` | Dirección (aparece en el PDF) |

---

## 11. Archivos clave del proyecto

| Archivo | Descripción |
|---|---|
| `app/admin/page.tsx` | Panel de administración completo (7 tabs) |
| `app/sale/page.tsx` | Pantalla de ventas para vendedores |
| `app/login/page.tsx` | Login de administrador |
| `app/page.tsx` | Página de inicio (acceso a venta y admin) |
| `lib/invoice.ts` | Generación de PDF (jsPDF) + upload automático a Storage |
| `lib/supabase.ts` | Cliente Supabase + tipos TypeScript de todas las entidades |
| `lib/offline.ts` | Caché de catálogo y ventas pendientes en localStorage |
| `lib/format.ts` | Formateo de moneda, fechas y mensajes WhatsApp |
| `supabase/schema.sql` | Definición completa de tablas, triggers, RLS y datos iniciales |
| `app/api/auth/[...nextauth]/route.ts` | Endpoints de autenticación — email/password y PIN |
| `middleware.ts` | Protección de rutas — redirige `/admin` si no hay sesión |
| `scripts/scrape-pelgy.mjs` | Scraper de productos desde WooCommerce |
| `scripts/upload-images.mjs` | Subida masiva de imágenes a Supabase Storage |

---

## 12. Flujo de trabajo Git

```
feature branch → PR → develop → PR → main → deploy automático en Vercel
```

- Commits en formato **Conventional Commits**: `feat(scope): descripción`
- El desarrollador hace `git add / commit / push` y abre el PR manualmente.
- Nunca se commitea directo a `develop` ni a `main`.

### Ramas

| Rama | Uso |
|---|---|
| `main` | Producción (Vercel) |
| `develop` | Integración |
| `feat/*` | Nuevas funcionalidades |
| `fix/*` | Correcciones de bugs |

---

## 13. Cómo correr el proyecto localmente

```bash
# Instalar dependencias
npm install

# Crear archivo de variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# Correr en desarrollo
npm run dev

# Build de producción
npm run build
```

El servidor arranca en `http://localhost:3000`.

---

*PELGY POS — Joyería de charms personalizada desde 1995*
