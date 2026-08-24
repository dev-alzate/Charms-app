# Postman — PELGY POS (Supabase REST API)

Colección de pruebas de API que valida los endpoints REST de Supabase (PostgREST)
que consume PELGY POS, más comprobaciones de las reglas de **Row Level Security (RLS)**.

Respalda la afirmación de QA del CV:
> _"Validé endpoints REST de Supabase y reglas de Row Level Security con Postman,
> verificando restricciones de acceso por rol y respuestas de error."_

## Archivos

- `PELGY-POS.postman_collection.json` — la colección (peticiones + tests `pm.test`).
- `PELGY-POS.postman_environment.json` — plantilla de entorno (sin secretos).

## Qué cubre

| Carpeta | Peticiones | Qué valida |
|---|---|---|
| **Lecturas (catálogo)** | categorías, productos (paginado / por categoría / búsqueda ilike), settings, métodos de pago, vendedor | Contrato de las lecturas de `/sale`: status, forma de la respuesta, filtros server-side y paginación (`Content-Range`). |
| **Escritura (ventas)** | `POST /sales` (feliz) y `POST /sales` con método inválido | El trigger asigna `invoice_number` en formato `F-YYYY-XXXX`; la restricción `CHECK` rechaza métodos de pago no permitidos. |
| **RLS / Seguridad** | `GET` sin apikey → 401; `GET` ventas con anon key → 200 | El límite de autenticación de la capa REST y que las políticas `USING(true)` son permisivas (documentado). |

## Cómo correrla

### Opción A — App de Postman
1. **Importar** ambos archivos (`Import` → arrastra los dos JSON).
2. Seleccionar el entorno **"PELGY POS — Local"** (arriba a la derecha).
3. Rellenar las variables del entorno con tus valores reales (los mismos de `.env.local`):
   - `supabase_url` = `NEXT_PUBLIC_SUPABASE_URL`
   - `anon_key` = `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - (opcional) `sample_category_id`, `seller_name`, `seller_code` para asserts más estrictos.
4. Ejecutar peticiones sueltas, o correr toda la colección con el **Collection Runner**.

### Opción B — Newman (CLI, para CI)
```bash
npx newman run postman/PELGY-POS.postman_collection.json \
  -e postman/PELGY-POS.postman_environment.json \
  --env-var "supabase_url=$NEXT_PUBLIC_SUPABASE_URL" \
  --env-var "anon_key=$NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

## Notas importantes

- **Secretos:** el archivo de entorno se versiona con valores **vacíos**. Nunca commitees tu
  `anon_key` real. En CI, pásala por `--env-var` desde un secret del pipeline.
- **La carpeta "Escritura" escribe en la BD.** El `POST crear venta` inserta una fila real en
  `sales`. Córrelo contra un proyecto de **staging/pruebas**, no producción. La venta creada queda
  con `customer_name = "Cliente QA Postman"` para poder identificarla y borrarla luego.
- **RLS abierta:** en este MVP de feria las políticas son `USING(true) WITH CHECK(true)` (un solo
  negocio, sin datos multi-tenant). La colección lo verifica y documenta de forma explícita en vez
  de ocultarlo.
