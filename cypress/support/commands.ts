/// <reference types="cypress" />

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de los comandos personalizados
// ─────────────────────────────────────────────────────────────────────────────
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Entra a /sale pasando el gate de vendedor (precarga sessionStorage). */
      startSale(sellerName?: string): Chainable<void>;
      /**
       * Stub de todas las lecturas de Supabase del catálogo (deterministas).
       * `requireSellerLogin: true` hace que el setting devuelva "true" para
       * ejercitar el gate de vendedor con validación.
       */
      stubCatalog(opts?: { requireSellerLogin?: boolean }): Chainable<void>;
      /**
       * Stub de la tabla `sellers`. Recibe la lista de vendedores válidos y
       * replica la validación `.ilike(name).eq(code)` del modal de identificación.
       */
      stubSellers(sellers: Array<{ id: string; name: string; code: string }>): Chainable<void>;
      /** Login del admin con cy.session (cacheado entre tests). */
      loginAdmin(): Chainable<void>;
      /** Fuerza modo offline: navigator.onLine=false + evento 'offline'. */
      goOffline(): Chainable<void>;
      /** Restaura conexión: navigator.onLine=true + evento 'online' (dispara sync). */
      goOnline(): Chainable<void>;
    }
  }
}

// ─── Stub del catálogo (Supabase reads) ──────────────────────────────────────
// La app habla directo a Supabase desde el cliente. Stubbeamos las lecturas para
// que las specs sean deterministas y corran sin BD real (ideal para CI).
Cypress.Commands.add("stubCatalog", (opts = {}) => {
  const requireSellerLogin = opts.requireSellerLogin === true;
  cy.fixture("catalog.json").then((cat) => {
    // settings.maybeSingle() → objeto único (Accept: pgrst.object+json)
    cy.intercept("GET", "**/rest/v1/settings*", {
      statusCode: 200,
      body: { value: requireSellerLogin ? "true" : "false" },
    }).as("settings");

    cy.intercept("GET", "**/rest/v1/categories*", {
      statusCode: 200,
      body: cat.categories,
    }).as("categories");

    cy.intercept("GET", "**/rest/v1/payment_methods*", {
      statusCode: 200,
      body: cat.paymentMethods,
    }).as("paymentMethods");

    // products: distingue la query de conteo (select=id, head:true) de la de datos
    cy.intercept("GET", "**/rest/v1/products*", (req) => {
      const filtered = filterProducts(cat.products, req.url);
      if (req.url.includes("select=id")) {
        req.reply({
          statusCode: 200,
          body: [],
          headers: { "content-range": `0-${filtered.length}/${filtered.length}` },
        });
      } else {
        req.reply({ statusCode: 200, body: filtered });
      }
    }).as("products");
  });
});

// Reproduce el filtrado server-side (categoría + búsqueda) para el stub
function filterProducts(products: any[], url: string): any[] {
  const decoded = decodeURIComponent(url);
  let result = products;
  const catMatch = decoded.match(/category_id=eq\.([^&]+)/);
  if (catMatch) result = result.filter((p) => p.category_id === catMatch[1]);
  const orMatch = decoded.match(/or=\(name\.ilike\.%([^%]+)%/);
  if (orMatch) {
    const q = orMatch[1].toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
    );
  }
  return result;
}

// ─── Stub de la tabla sellers (validación del gate de vendedor) ───────────────
// El modal valida con .eq("active",true).ilike("name",name).eq("code",code)
// .maybeSingle(). Parseamos name/code de la URL y devolvemos el objeto único si
// hay match, o null (→ supabase-js data:null → error en el modal) si no.
Cypress.Commands.add("stubSellers", (sellers) => {
  cy.intercept("GET", "**/rest/v1/sellers*", (req) => {
    // supabase-js codifica el espacio como '+' (no como %20); decodeURIComponent
    // no lo convierte, así que lo normalizamos a espacio antes de comparar.
    const decoded = decodeURIComponent(req.url).replace(/\+/g, " ");
    const nameMatch = decoded.match(/name=ilike\.([^&]+)/);
    const codeMatch = decoded.match(/code=eq\.([^&]+)/);
    const name = nameMatch ? nameMatch[1].replace(/\*/g, "").toLowerCase() : "";
    const code = codeMatch ? codeMatch[1] : "";
    const found = sellers.find(
      (s) => s.name.toLowerCase() === name && s.code === code
    );
    req.reply({
      statusCode: 200,
      // maybeSingle() espera objeto único o null (Accept: pgrst.object+json)
      body: found ? { id: found.id } : null,
    });
  }).as("sellers");
});

// ─── Gate de vendedor ────────────────────────────────────────────────────────
// El modal "¿Quién está vendiendo?" bloquea /sale hasta que hay un nombre en
// sessionStorage. Lo precargamos para no depender del modal en cada test.
Cypress.Commands.add("startSale", (sellerName = "QA Tester") => {
  cy.visit("/sale", {
    onBeforeLoad(win) {
      win.sessionStorage.setItem("charms_identifier_name", sellerName);
      win.sessionStorage.setItem("charms_seller_validated", "true");
    },
  });
});

// ─── Login admin (NextAuth credentials) ──────────────────────────────────────
Cypress.Commands.add("loginAdmin", () => {
  cy.session("admin", () => {
    cy.visit("/login");
    cy.get('input[type="email"]').type(String(Cypress.env("ADMIN_EMAIL")));
    cy.get('input[type="password"]').type(String(Cypress.env("ADMIN_PASSWORD")), {
      log: false,
    });
    cy.get('button[type="submit"]').click();
    cy.url().should("include", "/admin");
  });
});

// ─── Conexión ────────────────────────────────────────────────────────────────
// La venta offline solo se encola si navigator.onLine === false (ver
// confirmPayment en app/sale/page.tsx). Interceptar Supabase no basta.
function setOnLine(win: Window, value: boolean) {
  // navigator.onLine es un getter del prototipo; lo sombreamos en la instancia.
  Object.defineProperty(win.navigator, "onLine", {
    configurable: true,
    get: () => value,
  });
}

Cypress.Commands.add("goOffline", () => {
  cy.window().then((win) => {
    setOnLine(win, false);
    win.dispatchEvent(new win.Event("offline"));
  });
});

Cypress.Commands.add("goOnline", () => {
  cy.window().then((win) => {
    setOnLine(win, true);
    win.dispatchEvent(new win.Event("online"));
  });
});

export {};
