/// <reference types="cypress" />

// SUITE 1 — Autenticación (NextAuth credentials: email+contraseña y PIN)

describe("Autenticación admin", () => {
  it("TC-AUTH-01: login con email+contraseña redirige a /admin", () => {
    cy.visit("/login");
    cy.get('input[type="email"]').type(String(Cypress.env("ADMIN_EMAIL")));
    cy.get('input[type="password"]').type(String(Cypress.env("ADMIN_PASSWORD")), {
      log: false,
    });
    cy.get('button[type="submit"]').click();
    cy.url().should("include", "/admin");
    cy.contains("Panel POS").should("be.visible");
  });

  it("TC-AUTH-01b: login con PIN redirige a /admin", () => {
    cy.visit("/login");
    cy.contains("button", "Código PIN").click();
    cy.get('input[inputmode="numeric"]').type(String(Cypress.env("ADMIN_PIN")), {
      log: false,
    });
    cy.get('button[type="submit"]').click();
    cy.url().should("include", "/admin");
  });

  it("TC-AUTH-02: credenciales inválidas muestran error y no redirigen", () => {
    cy.visit("/login");
    cy.get('input[type="email"]').type("noexiste@pelgy.com");
    cy.get('input[type="password"]').type("clave-incorrecta");
    cy.get('button[type="submit"]').click();
    cy.contains("Correo o contraseña incorrectos.").should("be.visible");
    cy.url().should("include", "/login");
  });

  it("TC-AUTH-03: /admin sin sesión redirige a /login", () => {
    cy.clearCookies();
    cy.visit("/admin");
    cy.url().should("include", "/login");
  });

  it("TC-AUTH-04: logout cierra la sesión", () => {
    // Login directo por UI (sin cy.session, para poder invalidar de verdad)
    cy.visit("/login");
    cy.get('input[type="email"]').type(String(Cypress.env("ADMIN_EMAIL")));
    cy.get('input[type="password"]').type(String(Cypress.env("ADMIN_PASSWORD")), {
      log: false,
    });
    cy.get('button[type="submit"]').click();
    cy.url().should("include", "/admin");

    cy.get('[data-testid="logout-btn"]').click();
    cy.url().should("include", "/login");

    // Ya no debe poder entrar al admin
    cy.visit("/admin");
    cy.url().should("include", "/login");
  });
});
