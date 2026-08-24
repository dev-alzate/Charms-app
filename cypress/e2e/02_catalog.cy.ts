/// <reference types="cypress" />

// SUITE 2 — Catálogo en venta
// Lecturas de Supabase stubbeadas (cy.stubCatalog) → deterministas y sin BD real.
// El filtro por categoría y la búsqueda son server-side; el stub reproduce el filtro.

describe("Catálogo en /sale", () => {
  beforeEach(() => {
    cy.stubCatalog();
    cy.startSale("QA Tester");
    cy.wait("@products");
  });

  it("TC-CAT-01: carga productos con nombre y precio", () => {
    cy.get('[data-testid="product-card"]')
      .should("have.length", 5)
      .first()
      .within(() => {
        cy.get(".font-serif").should("contain.text", "$"); // precio formateado (COP)
      });
  });

  it("TC-CAT-02: filtrar por categoría muestra solo esa categoría", () => {
    // "Letras" (cat-2) tiene 2 productos en el fixture
    cy.get("header").contains("button", "Letras").click();
    cy.wait("@products");
    cy.get('[data-testid="product-card"]').should("have.length", 2);
    cy.get('[data-testid="product-card"][data-code="L-A"]').should("exist");
  });

  it("TC-CAT-03: buscar un término inexistente muestra estado vacío", () => {
    cy.get('[data-testid="search-input"]').type("zzz-no-existe-xyz");
    cy.wait("@products"); // espera el fetch tras el debounce de 300ms
    cy.contains("No hay productos que coincidan con tu búsqueda.").should(
      "be.visible"
    );
  });

  it("TC-CAT-04: con una sola página se marca el fin del catálogo", () => {
    // 5 productos < PAGE_SIZE (30) → no hay más que cargar
    cy.get('[data-testid="product-card"]').should("have.length", 5);
    cy.scrollTo("bottom");
    cy.contains("Fin del catálogo").should("exist");
  });
});
