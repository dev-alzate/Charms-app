/// <reference types="cypress" />

// SUITE 7 — Rol VENDEDOR con login requerido (require_seller_login = true)
// El resto de suites saltan el gate de vendedor precargando sessionStorage
// (cy.startSale). Aquí ejercitamos el gate REAL: el modal exige nombre + código
// y valida contra la tabla `sellers` de Supabase (stubbeada de forma determinista).
// Ver app/sale/page.tsx (init useEffect y submitIdentifier).

const VALID_SELLER = { id: "seller-1", name: "Ana Vendedora", code: "1234" };

describe("Gate de vendedor (login requerido)", () => {
  beforeEach(() => {
    cy.stubCatalog({ requireSellerLogin: true });
    cy.stubSellers([VALID_SELLER]);
    // Visitamos /sale SIN precargar sessionStorage: el modal debe bloquear.
    cy.visit("/sale");
    cy.wait("@settings");
    cy.contains("¿Quién está vendiendo?", { timeout: 10000 }).should("be.visible");
  });

  it("TC-SELLER-01: el gate exige nombre Y código (Continuar deshabilitado sin código)", () => {
    // Con login requerido aparece el campo de código.
    cy.get('input[placeholder="Código de vendedor"]').should("exist");

    // Solo con nombre, el botón sigue deshabilitado.
    cy.get('input[placeholder="Tu nombre"]').type(VALID_SELLER.name);
    cy.contains("button", "Continuar").should("be.disabled");

    // Al escribir el código, se habilita.
    cy.get('input[placeholder="Código de vendedor"]').type(VALID_SELLER.code);
    cy.contains("button", "Continuar").should("not.be.disabled");
  });

  it("TC-SELLER-02: código inválido muestra error y NO deja pasar", () => {
    cy.get('input[placeholder="Tu nombre"]').type(VALID_SELLER.name);
    cy.get('input[placeholder="Código de vendedor"]').type("0000");
    cy.contains("button", "Continuar").click();

    cy.wait("@sellers");
    cy.contains("Nombre o código de vendedor incorrecto.").should("be.visible");
    // Sigue bloqueado: el modal permanece visible.
    cy.contains("¿Quién está vendiendo?").should("be.visible");
  });

  it("TC-SELLER-03: nombre + código válidos pasan el gate y cargan el catálogo", () => {
    cy.get('input[placeholder="Tu nombre"]').type(VALID_SELLER.name);
    cy.get('input[placeholder="Código de vendedor"]').type(VALID_SELLER.code);
    cy.contains("button", "Continuar").click();

    cy.wait("@sellers");
    cy.wait("@products");

    // El modal desaparece y se ve el catálogo.
    cy.contains("¿Quién está vendiendo?").should("not.exist");
    cy.get('[data-testid="product-card"]', { timeout: 10000 })
      .should("have.length.greaterThan", 0);

    // La sesión de vendedor quedó validada.
    cy.window().then((win) => {
      expect(win.sessionStorage.getItem("charms_seller_validated")).to.eq("true");
      expect(win.sessionStorage.getItem("charms_identifier_name")).to.eq(
        VALID_SELLER.name
      );
    });
  });

  it("TC-SELLER-04: el nombre del vendedor se registra en el payload de la venta", () => {
    cy.intercept("POST", "**/rest/v1/sales*", (req) => {
      // El vendedor autenticado viaja como identifier_name.
      expect(req.body.identifier_name).to.eq(VALID_SELLER.name);
      req.reply({
        statusCode: 201,
        body: {
          id: "test-sale-seller",
          invoice_number: "F-2026-0007",
          ticket_number: 7,
          items: [],
          total: 0,
          payment_method: "cash",
          customer_name: null,
          customer_phone: null,
          identifier_name: VALID_SELLER.name,
          notes: null,
          pdf_url: null,
          created_at: new Date().toISOString(),
        },
      });
    }).as("createSale");

    // Pasar el gate.
    cy.get('input[placeholder="Tu nombre"]').type(VALID_SELLER.name);
    cy.get('input[placeholder="Código de vendedor"]').type(VALID_SELLER.code);
    cy.contains("button", "Continuar").click();
    cy.wait("@products");

    // Completar una venta.
    cy.get('[data-testid="product-card"]').first().click();
    cy.get('[data-testid="pm-cash"]:visible').click();
    cy.get('[data-testid="checkout-btn"]:visible').click();
    cy.get('[data-testid="confirm-sale-btn"]').click();
    cy.wait("@createSale");

    cy.get('[data-testid="sale-success"]').should("be.visible");
  });
});
