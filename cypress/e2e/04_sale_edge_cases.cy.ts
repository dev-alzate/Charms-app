/// <reference types="cypress" />

// SUITE 4 — Casos borde de venta (ajustados al comportamiento real del código)

describe("Casos borde de venta", () => {
  beforeEach(() => {
    cy.stubCatalog();
    cy.startSale("QA Tester");
    cy.wait("@products");
    cy.get('[data-testid="product-card"]').should("have.length.greaterThan", 0);
  });

  it("TC-EDGE-01: cobrar sin método de pago no avanza y avisa", () => {
    cy.get('[data-testid="product-card"]').first().click();
    // Con productos pero sin método seleccionado
    cy.get('[data-testid="checkout-btn"]:visible').click();
    // El aviso existe en el carrito móvil (oculto) y el sidebar desktop (visible);
    // acotamos a la copia visible.
    cy.contains(":visible", "Por favor selecciona un método de pago").should(
      "be.visible"
    );
    // No debe existir el botón de confirmar (no avanzó a checkout)
    cy.get('[data-testid="confirm-sale-btn"]').should("not.exist");
  });

  it("TC-EDGE-02: el mismo producto dos veces suma cantidad (sin duplicar línea)", () => {
    cy.get('[data-testid="product-card"]').first().click();
    cy.get('[data-testid="product-card"]').first().click();
    cy.get('[data-testid="cart-line"]').should("have.length", 1);
    cy.get('[data-testid="cart-line"]').first().contains("2");
  });

  it("TC-EDGE-03: bajar de 1 elimina la línea del carrito", () => {
    cy.get('[data-testid="product-card"]').first().click();
    cy.get('[data-testid="cart-line"]')
      .first()
      .within(() => {
        cy.contains("button", "−").click(); // signo menos (U+2212), como en el código
      });
    cy.get('[data-testid="cart-line"]').should("have.length", 0);
  });

  it("TC-EDGE-04: el total es la suma exacta de los ítems", () => {
    // Tomamos 2 tarjetas y leemos su precio del código data-code no da precio,
    // así que sumamos lo que la app calcula por línea y lo comparamos con el Total.
    cy.get('[data-testid="product-card"]').eq(0).click();
    cy.get('[data-testid="product-card"]').eq(1).click();

    // Suma de subtotales de cada línea (texto tipo "$5.000")
    const parse = (t: string) => Number(t.replace(/[^\d]/g, ""));
    cy.get('[data-testid="cart-line"]').then(($lines) => {
      let sum = 0;
      $lines.each((_i, el) => {
        const subtotal = Cypress.$(el).find(".font-serif").last().text();
        sum += parse(subtotal);
      });
      // El Total del sidebar debe coincidir con la suma
      cy.contains("Total")
        .parent()
        .find(".font-serif")
        .last()
        .invoke("text")
        .then((totalText) => {
          expect(parse(totalText)).to.eq(sum);
        });
    });
  });
});
