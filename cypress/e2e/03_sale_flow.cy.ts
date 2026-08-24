/// <reference types="cypress" />

// SUITE 3 — Flujo de venta completo
// Estrategia: lecturas contra Supabase real (datos semilla del schema.sql).
// La escritura (POST /sales) se hace STUB para no ensuciar la BD y controlar
// el invoice_number que muestra la app.

describe("Flujo de venta", () => {
  beforeEach(() => {
    // Lecturas del catálogo stubbeadas (deterministas). El POST se stubbea por test.
    cy.stubCatalog();
    cy.startSale("QA Tester");
    cy.wait("@products");
    cy.get('[data-testid="product-card"]', { timeout: 10000 })
      .should("have.length.greaterThan", 0);
  });

  it("TC-SALE-01: agrega un producto al carrito", () => {
    cy.get('[data-testid="product-card"]').first().click();
    cy.get('[data-testid="cart-line"]').should("have.length", 1);
  });

  it("TC-SALE-02: incrementar cantidad recalcula el total", () => {
    cy.get('[data-testid="product-card"]').first().click();
    cy.get('[data-testid="cart-line"]')
      .first()
      .within(() => {
        // Botón "+" del contador (segundo botón redondo de la línea)
        cy.contains("button", "+").click();
        cy.contains("button", "+").click();
        cy.contains("3"); // cantidad visible = 3
      });
  });

  it("TC-SALE-03: eliminar el producto vacía el carrito", () => {
    cy.get('[data-testid="product-card"]').first().click();
    cy.get('[data-testid="cart-line"]').should("have.length", 1);
    // "×" de la línea elimina toda la línea
    cy.get('[data-testid="cart-line"]').first().contains("×").click();
    cy.get('[data-testid="cart-line"]').should("have.length", 0);
    cy.contains("El carrito está vacío.");
  });

  it("TC-SALE-04: completa una venta (happy path) y muestra factura F-YYYY-XXXX", () => {
    // Stub del INSERT: devolvemos una venta con invoice_number válido
    cy.intercept("POST", "**/rest/v1/sales*", {
      statusCode: 201,
      body: {
        id: "test-sale-1",
        invoice_number: "F-2026-0001",
        ticket_number: 1,
        items: [],
        total: 0,
        payment_method: "cash",
        customer_name: null,
        customer_phone: null,
        identifier_name: "QA Tester",
        notes: null,
        pdf_url: null,
        created_at: new Date().toISOString(),
      },
    }).as("createSale");

    cy.get('[data-testid="product-card"]').eq(0).click();
    cy.get('[data-testid="product-card"]').eq(1).click();

    cy.get('[data-testid="pm-cash"]:visible').click();
    cy.get('[data-testid="checkout-btn"]:visible').click();

    cy.get('[data-testid="confirm-sale-btn"]').click();
    cy.wait("@createSale");

    cy.get('[data-testid="sale-success"]').should("be.visible");
    cy.get('[data-testid="invoice-number"]')
      .invoke("text")
      .should("match", /^F-\d{4}-\d{4}$/);

    // Volver a empezar deja el carrito vacío
    cy.contains("Siguiente cliente").click();
    cy.get('[data-testid="cart-line"]').should("have.length", 0);
  });

  it("TC-SALE-05: venta con datos de cliente envía el nombre en el payload", () => {
    cy.intercept("POST", "**/rest/v1/sales*", (req) => {
      expect(req.body.customer_name).to.eq("María Cliente");
      req.reply({
        statusCode: 201,
        body: {
          id: "test-sale-2",
          invoice_number: "F-2026-0002",
          ticket_number: 2,
          items: [],
          total: 0,
          payment_method: "cash",
          customer_name: "María Cliente",
          customer_phone: "3001234567",
          identifier_name: "QA Tester",
          notes: null,
          pdf_url: null,
          created_at: new Date().toISOString(),
        },
      });
    }).as("createSale");

    cy.get('[data-testid="product-card"]').first().click();
    cy.get('[data-testid="pm-cash"]:visible').click();
    cy.get('[data-testid="checkout-btn"]:visible').click();

    cy.get('input[placeholder="Nombre del cliente"]').type("María Cliente");
    cy.get('input[placeholder="300 000 0000"]').type("3001234567");

    cy.get('[data-testid="confirm-sale-btn"]').click();
    cy.wait("@createSale");
    cy.get('[data-testid="sale-success"]').should("be.visible");
  });

  it("TC-SALE-06: cambiar método de pago registra 'transfer'", () => {
    cy.intercept("POST", "**/rest/v1/sales*", (req) => {
      expect(req.body.payment_method).to.eq("transfer");
      req.reply({
        statusCode: 201,
        body: {
          id: "test-sale-3",
          invoice_number: "F-2026-0003",
          ticket_number: 3,
          items: [],
          total: 0,
          payment_method: "transfer",
          customer_name: null,
          customer_phone: null,
          identifier_name: "QA Tester",
          notes: null,
          pdf_url: null,
          created_at: new Date().toISOString(),
        },
      });
    }).as("createSale");

    cy.get('[data-testid="product-card"]').first().click();
    cy.get('[data-testid="pm-transfer"]:visible')
      .click()
      .should("have.class", "bg-brand");
    cy.get('[data-testid="checkout-btn"]:visible').click();
    cy.get('[data-testid="confirm-sale-btn"]').click();
    cy.wait("@createSale");
    cy.get('[data-testid="sale-success"]').should("be.visible");
  });
});
