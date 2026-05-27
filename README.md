# Charms App — POS para joyería de charms

Sistema POS web (PWA) optimizado para vender pulseras de charms personalizados en ferias.
Flujo de dos roles: **identificador** (cobra desde tablet) → **armador** (recibe WhatsApp y ensambla).

> **Costo de operación: $0/mes.** Todo corre en los free tier de Supabase + Vercel.

---

## ⚡ Cómo desplegarlo (guía rápida sin línea de comandos)

### 1. Cuentas necesarias (todas gratis)

- [GitHub](https://github.com) — para almacenar el código
- [Supabase](https://supabase.com) — base de datos
- [Vercel](https://vercel.com) — hosting

> 💡 Crea las 3 cuentas con el **mismo correo** y conecta Supabase + Vercel a GitHub.

### 2. Subir el código a GitHub

Si no usas terminal:

1. Descarga e instala [GitHub Desktop](https://desktop.github.com).
2. Abre GitHub Desktop → **File → Add Local Repository** → selecciona la carpeta `charms-app`.
3. Publica el repositorio (puede ser privado).

### 3. Crear la base de datos en Supabase

1. En Supabase, crea un **New Project**. Anota la contraseña.
2. Ve a **SQL Editor** → **New query**.
3. Abre el archivo `supabase/schema.sql` de este repo, copia TODO su contenido y pégalo.
4. Click en **Run**. Debería terminar sin errores y crear 4 tablas (categories, products, sales, settings).
5. Ve a **Project Settings → API** y copia:
   - **Project URL** → la usarás como `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → la usarás como `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4. Desplegar en Vercel

1. En Vercel: **Add New → Project** → selecciona el repo de GitHub.
2. En **Environment Variables**, pega las 6 variables (ver `.env.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
NEXT_PUBLIC_BUSINESS_NAME=Mi Joyería
NEXT_PUBLIC_BUSINESS_NIT=900.000.000-0
NEXT_PUBLIC_BUSINESS_PHONE=+57 300 000 0000
NEXT_PUBLIC_BUSINESS_ADDRESS=Bogotá, Colombia
```

3. Click **Deploy**. En ~2 minutos tendrás una URL pública (`tu-proyecto.vercel.app`).

### 5. Configuración inicial

Abre la URL y:

1. Ve a **Administración → Configuración** y pega el **número de WhatsApp del armador**.
   - Formato: con código de país, sin espacios. Ej: `573001234567`.
2. Ve a **Administración → Importar** y pega tu Excel con los productos.
   - Columnas: `codigo`, `nombre`, `precio`, `categoria` (esta última opcional; se crea sola si no existe).

¡Listo para vender!

---

## 📱 Cómo se usa en feria

### Identificador (tablet)

1. Abre la URL en el navegador, agrégala a la pantalla inicio para que se vea como app.
2. Toca **VENDER** y escribe tu nombre (queda guardado durante el turno).
3. Por cada cliente:
   - Toca la **categoría** correspondiente.
   - Toca cada producto que el cliente trajo en su bandeja → se va sumando al carrito.
   - Toca **Cobrar**, elige método de pago, opcionalmente registra el celular del cliente.
   - Toca **Confirmar**.
4. En la pantalla de éxito toca **Enviar al armador** → se abre WhatsApp con el mensaje listo. Solo confirmas el envío.
5. Toca **Siguiente cliente**.

### Armador (celular personal)

Solo necesita su celular con WhatsApp. Recibe los mensajes con el ticket, la lista de piezas y el cliente.

---

## 🛠 Desarrollo local

```bash
npm install
cp .env.example .env.local   # rellena con tus credenciales
npm run dev                   # http://localhost:3000
```

Build de producción:

```bash
npm run build
npm start
```

---

## 📂 Estructura

```
charms-app/
├── app/
│   ├── layout.tsx              metadata + PWA
│   ├── page.tsx                home con VENDER / Admin
│   ├── sale/page.tsx           ⭐ pantalla principal de venta
│   └── admin/page.tsx          ⭐ panel admin (5 tabs)
├── lib/
│   ├── supabase.ts             cliente + tipos
│   ├── format.ts               formato moneda, fecha, WhatsApp, mensaje al armador
│   └── invoice.ts              generador de PDF (80mm, recibo térmico)
├── supabase/
│   └── schema.sql              tablas + triggers + datos de muestra
├── public/
│   ├── manifest.json
│   └── icon.svg
└── docs/
    └── ARQUITECTURA.md         decisiones técnicas y por qué
```

---

## ❓ Problemas comunes

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| "Error al cargar" en `/sale` | Variables de entorno mal configuradas en Vercel | Revisa Settings → Environment Variables y redeploy |
| Botón "Enviar al armador" no abre WhatsApp | No configuraste el número en `/admin → Configuración` | Configúralo con código de país (ej: `573001234567`) |
| El PDF de factura no descarga | Bloqueador de popups del navegador | Permite descargas para este sitio |
| Importación falla | Columnas con nombres no reconocidos | Usa cabeceras: `codigo`, `nombre`, `precio`, `categoria` |

Para cualquier otra duda, revisa `docs/ARQUITECTURA.md` o el brief original en `brief_claude_code_charms_app.md`.

---

## 🚧 Funcionalidades pendientes (próximas iteraciones)

- Modo offline real con service worker (alta prioridad — WiFi malo en ferias).
- Fotos de productos en Supabase Storage.
- Confirmación de recepción del armador.
- Devoluciones / notas crédito.
- Multi-armador, reportes avanzados, descuentos por combo.
