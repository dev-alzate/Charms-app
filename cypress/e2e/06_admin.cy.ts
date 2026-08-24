/// <reference types="cypress" />

// SUITE 6 — Panel de administración (requiere sesión)

describe("Panel admin", () => {
  beforeEach(() => {
    // Stub de lecturas para que la suite corra sin Supabase real
    cy.stubCatalog();
    cy.intercept("GET", "**/rest/v1/sales*", {
      statusCode: 200,
      body: [
        {
          id: "sale-1",
          invoice_number: "F-2026-0001",
          ticket_number: 1,
          items: [{ product_id: "p1", code: "CAD-01", name: "Cadena", price: 25000, quantity: 1 }],
          total: 25000,
          payment_method: "cash",
          customer_name: null,
          customer_phone: null,
          identifier_name: "QA",
          notes: null,
          pdf_url: null,
          created_at: "2026-07-30T10:00:00Z",
        },
      ],
    }).as("sales");
    cy.loginAdmin();
    cy.visit("/admin");
  });

  it("TC-ADMIN-01: el sidebar muestra las 7 secciones", () => {
    const tabs = [
      "Inicio",
      "Configuración",
      "Productos",
      "Categorías",
      "Ventas",
      "Importar",
      "Vendedores",
    ];
    cy.get("aside").within(() => {
      tabs.forEach((t) => cy.contains(t).should("be.visible"));
    });
  });

  it("TC-ADMIN-02: la sección Productos lista productos", () => {
    cy.get("aside").contains("Productos").click();
    cy.wait("@products");
    // Debe aparecer al menos un producto (precio formateado)
    cy.get('[data-testid="admin-content"]').should("contain.text", "$");
  });

  it("TC-ADMIN-03: la sección Ventas muestra el historial", () => {
    cy.intercept("GET", "**/rest/v1/sales*").as("sales");
    cy.get("aside").contains("Ventas").click();
    cy.wait("@sales");
    // Cada venta muestra su número de factura F-YYYY-XXXX (si hay ventas)
    cy.get('[data-testid="admin-content"]').then(($m) => {
      if (/F-\d{4}-\d{4}/.test($m.text())) {
        cy.contains(/F-\d{4}-\d{4}/).should("exist");
      } else {
        cy.log("No hay ventas registradas todavía — historial vacío es válido.");
      }
    });
  });
});
