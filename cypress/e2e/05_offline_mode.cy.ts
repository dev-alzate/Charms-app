/// <reference types="cypress" />

// SUITE 5 — Modo offline
// Clave: la venta offline SOLO se encola si navigator.onLine === false, además de
// que la red falle. Por eso combinamos cy.intercept (red) con cy.goOffline().

const CATALOG_KEY = "pelgy_catalog_cache";
const PENDING_KEY = "pelgy_pending_sales";

describe("Modo offline", () => {
  it("TC-OFFLINE-01: catálogo desde caché cuando no hay conexión", () => {
    cy.stubCatalog();
    cy.startSale("QA Tester");
    cy.wait("@products");

    // Esperar a que el fetch de calentamiento guarde la caché
    cy.window().then((win) => {
      cy.wrap(null, { timeout: 10000 }).should(() => {
        expect(win.localStorage.getItem(CATALOG_KEY)).to.not.be.null;
      });
    });

    // Simular caída de Supabase y recargar (sessionStorage persiste).
    // Usamos 500 (no forceNetworkError) para que supabase-js resuelva con error
    // y la app entre a su rama offline, en vez de dejar el fetch colgado.
    cy.intercept("GET", "**/rest/v1/**", { statusCode: 500, body: {} }).as("dead");
    cy.reload();

    cy.contains("mostrando catálogo guardado", { timeout: 12000 }).should(
      "be.visible"
    );
    cy.get('[data-testid="product-card"]').should("have.length.greaterThan", 0);
  });

  it("TC-OFFLINE-02: la venta offline se guarda en la cola pendiente", () => {
    cy.stubCatalog();
    cy.startSale("QA Tester");
    cy.wait("@products");
    cy.get('[data-testid="product-card"]').should("have.length.greaterThan", 0);

    // Preparamos el carrito con conexión
    cy.get('[data-testid="product-card"]').first().click();
    cy.get('[data-testid="pm-cash"]:visible').click();
    cy.get('[data-testid="checkout-btn"]:visible').click();

    // Ahora sí: sin red + offline
    cy.intercept("POST", "**/rest/v1/sales*", { forceNetworkError: true }).as("deadPost");
    cy.goOffline();

    cy.get('[data-testid="confirm-sale-btn"]').click();

    // Pantalla de éxito con factura LOCAL-* y cola persistida
    cy.get('[data-testid="sale-success"]').should("be.visible");
    cy.get('[data-testid="invoice-number"]')
      .invoke("text")
      .should("match", /^LOCAL-/);

    cy.window().then((win) => {
      const pending = JSON.parse(win.localStorage.getItem(PENDING_KEY) || "[]");
      expect(pending).to.have.length(1);
    });
  });

  it("TC-OFFLINE-03: la cola se sincroniza al recuperar conexión", () => {
    cy.stubCatalog();
    cy.startSale("QA Tester");
    cy.wait("@products");

    // Sembramos una venta pendiente en localStorage
    cy.window().then((win) => {
      const pending = [
        {
          localId: "local_test_1",
          items: [{ product_id: "p1", code: "T", name: "T", price: 5000, quantity: 1 }],
          total: 5000,
          payment_method: "cash",
          customer_name: null,
          customer_phone: null,
          identifier_name: "QA Tester",
          createdAt: new Date().toISOString(),
        },
      ];
      win.localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    });

    cy.intercept("POST", "**/rest/v1/sales*", { statusCode: 201, body: {} }).as("sync");
    cy.goOnline();

    cy.wait("@sync");
    cy.window().then((win) => {
      const pending = JSON.parse(win.localStorage.getItem(PENDING_KEY) || "[]");
      expect(pending).to.have.length(0);
    });
    cy.contains("Ventas sincronizadas").should("be.visible");
  });

  it("TC-OFFLINE-04: pérdida de conexión a mitad de venta encola correctamente", () => {
    cy.stubCatalog();
    cy.startSale("QA Tester");
    cy.wait("@products");
    cy.get('[data-testid="product-card"]').should("have.length.greaterThan", 0);

    cy.get('[data-testid="product-card"]').first().click();
    cy.get('[data-testid="pm-cash"]:visible').click();
    cy.get('[data-testid="checkout-btn"]:visible').click();

    // Se cae la red justo antes de confirmar
    cy.intercept("POST", "**/rest/v1/sales*", { forceNetworkError: true }).as("deadPost");
    cy.goOffline();
    cy.get('[data-testid="confirm-sale-btn"]').click();

    cy.get('[data-testid="sale-success"]').should("be.visible");
    cy.window().then((win) => {
      const pending = JSON.parse(win.localStorage.getItem(PENDING_KEY) || "[]");
      expect(pending.length).to.be.greaterThan(0);
    });
  });
});
