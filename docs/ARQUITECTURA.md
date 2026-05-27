# Arquitectura — Charms App

Documento de referencia para futuros desarrolladores (o futuro-yo).
Resume las decisiones técnicas y, sobre todo, **por qué** se tomaron así.

---

## 1. Stack

| Capa | Tecnología | Razón |
|------|------------|-------|
| Frontend | Next.js 14 (App Router) + React 18 + TypeScript | Routing + SSR + PWA en un solo framework |
| Estilos | Tailwind CSS | Rápido para mobile-first, botones grandes |
| Backend | Next.js API Routes (no usadas todavía — cliente habla directo a Supabase) | Posibilidad futura sin servidor separado |
| Base de datos | Supabase (PostgreSQL) | Free tier generoso, SQL real |
| PDF | jsPDF + jspdf-autotable (client-side) | Sin costo de servidor, formato 80mm |
| WhatsApp | Link `wa.me` con mensaje URL-encoded | Cero infraestructura |
| Hosting | Vercel (Hobby tier) | Gratis, deploy desde GitHub |

**Costo total mensual:** $0 USD. Free tier soporta >50.000 ventas/mes.

---

## 2. Decisiones de producto cerradas

Estas se evaluaron, se descartaron y **no deben revisarse sin contexto explícito**.

### 2.1. ❌ Sin IA Vision para identificar charms

Probabilidad de acierto con 13 piezas similares por venta: `0.8^13 = 5.5%`. Inviable.
Además: costo por foto (~$0.03), latencia 2-5s, necesita internet estable. Y la precisión real con 200 productos similares era 60-75%, no 90%+.

### 2.2. ❌ Sin QR físicos en los charms

Los charms son piezas pequeñas (1-2 cm) sin superficie plana. QRs < 1cm fallan al escanearse. Los stickers se despegan. Daña la estética del producto.

### 2.3. ✅ Selección manual por categorías visuales

Tabs por categoría + grid de productos + búsqueda global. Tiempo objetivo por venta de 13 piezas: 30-50 segundos.

### 2.4. ✅ Armador sin tablet — coordinación por WhatsApp

Originalmente había 2 tablets sincronizadas con Supabase Realtime. Se descartó: el armador solo necesita el celular. Menos hardware, más simple, WhatsApp ya lo tienen todos.

### 2.5. ❌ Sin login / autenticación

El equipo no quiere login en plena venta. RLS habilitado pero con políticas permisivas a `anon`. Si en el futuro se quiere proteger admin, refinar políticas o agregar password-gate.

---

## 3. Modelo de datos

4 tablas en Supabase (ver `supabase/schema.sql`):

- **`categories`** — `id, name, display_order, color, active, created_at`
- **`products`** — `id, code, name, price, category_id, active, display_order, created_at, updated_at`
- **`sales`** — `id, invoice_number, ticket_number, items (jsonb), total, payment_method, customer_name, customer_phone, identifier_name, notes, created_at`
- **`settings`** — `key, value, updated_at` (clave-valor)

### Triggers SQL

- `generate_invoice_number()` → genera `F-YYYY-XXXX` (secuencia anual).
- `get_next_ticket_number()` → entero secuencial diario (resetea cada día).
- `set_invoice_number()` BEFORE INSERT en `sales` que llena ambos automáticamente.
- `touch_updated_at()` BEFORE UPDATE en `products`.

### Items como jsonb

Las líneas de una venta se guardan dentro de la columna `items` (jsonb) en `sales` — **NO** hay tabla `sale_items` aparte. Razones:

- Una venta es atómica e inmutable; nunca editas líneas después.
- Permite que `products` cambien de precio sin afectar ventas históricas.
- Menos joins → consulta de "últimas 100 ventas" es trivial.

---

## 4. Flujo principal (pantalla de venta)

```
[Modal identificación]
       ↓
[Grid de productos] ←──────┐
       ↓                   │
   [Carrito]               │
       ↓                   │
   [Checkout]              │
       ↓                   │
   [INSERT sales]          │
       ↓                   │
   [Pantalla éxito]        │
       ↓                   │
   ├─ Enviar al armador (wa.me)
   ├─ Descargar PDF (jsPDF)
   ├─ Enviar al cliente (wa.me, si dio celular)
   └─ Siguiente cliente ───┘
```

Todo el estado de la venta vive en React state (en `app/sale/page.tsx`). No hay sincronización entre tablets — cada identificador opera independiente.

---

## 5. Métrica de éxito

> ¿La usuaria puede atender 60–90 clientes/hora en su feria sin estrés?

Si no, hay que optimizar el flujo de venta (más botones, menos toques, mejor búsqueda) antes que cualquier otra cosa.

---

## 6. Por qué Next.js + Vercel + Supabase

Por separado: cualquier dueño de negocio puede crear cuentas, copiar credenciales, importar Excel y empezar a vender. Sin servidores que mantener, sin docker, sin SSH. Free tier real (no trial).

---

## 7. Pendientes documentados

Ver sección 6 del brief original (`brief_claude_code_charms_app.md`) y sección final del `README.md`. Los prioritarios son: modo offline real, fotos de productos, confirmación del armador, devoluciones.
