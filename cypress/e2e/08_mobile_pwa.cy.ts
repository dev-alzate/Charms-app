/// <reference types="cypress" />

// SUITE 8 — Flujo de venta en MÓVIL (PWA)
// El resto de suites corren en viewport de escritorio (1280×800) donde el carrito
// es un sidebar. En móvil (< lg) el carrito es un panel flotante inferior con su
// propio método de pago y botón "Cobrar". Aquí validamos ese layout en un viewport
// de teléfono (iPhone X, 375×812), cubriendo la afirmación "móvil (PWA) y escritorio".

describe("Venta en móvil (PWA)", () => {
  beforeEach(() => {
    cy.viewport("iphone-x"); // 375×812
    cy.stubCatalog();
    cy.startSale("QA Tester");
    cy.wait("@products");
    cy.get('[data-testid="product-card"]', { timeout: 10000 })
      .should("have.length.greaterThan", 0);
  });

  it("TC-MOB-01: el catálogo se renderiza y el sidebar de escritorio queda oculto", () => {
    cy.get('[data-testid="product-card"]').first().should("be.visible");
    // El <aside> de escritorio existe en el DOM pero no debe verse en móvil.
    cy.get("aside").should("not.be.visible");
  });

  it("TC-MOB-02: agregar al carrito muestra el panel flotante y su detalle", () => {
    cy.get('[data-testid="product-card"]').first().click();

    // El panel flotante inferior aparece con el conteo de piezas.
    cy.contains("en carrito").should("be.visible");

    // Expandir "ver detalle" muestra la línea con el nombre del producto.
    cy.contains("ver detalle").click();
    cy.fixture("catalog.json").then((cat) => {
      cy.contains(cat.products[0].name).should("be.visible");
    });
  });

  it("TC-MOB-03: checkout feliz en móvil muestra factura F-YYYY-XXXX", () => {
    cy.intercept("POST", "**/rest/v1/sales*", {
      statusCode: 201,
      body: {
        id: "test-sale-mobile",
        invoice_number: "F-2026-0008",
        ticket_number: 8,
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

    cy.get('[data-testid="product-card"]').first().click();

    // Método de pago y "Cobrar" del panel móvil (los de escritorio están ocultos).
    cy.get('[data-testid="pm-cash"]:visible').click();
    cy.get('[data-testid="checkout-btn"]:visible').click();

    cy.get('[data-testid="confirm-sale-btn"]').click();
    cy.wait("@createSale");

    cy.get('[data-testid="sale-success"]').should("be.visible");
    cy.get('[data-testid="invoice-number"]')
      .invoke("text")
      .should("match", /^F-\d{4}-\d{4}$/);
  });
});
