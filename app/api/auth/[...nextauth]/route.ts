import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    // ── Método 1: Email + contraseña ────────────────────────────────────
    CredentialsProvider({
      id: "email",
      name: "Correo y contraseña",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) return null;

        if (
          credentials?.email?.toLowerCase().trim() === adminEmail.toLowerCase() &&
          credentials?.password === adminPassword
        ) {
          return { id: "admin", name: "Administrador", email: adminEmail };
        }
        return null;
      },
    }),

    // ── Método 2: PIN de administrador ──────────────────────────────────
    CredentialsProvider({
      id: "pin",
      name: "Código PIN",
      credentials: {
        pin: { label: "PIN de administrador", type: "password" },
      },
      async authorize(credentials) {
        const adminPin = process.env.ADMIN_PIN;
        if (!adminPin) return null;

        if (credentials?.pin === adminPin) {
          return { id: "admin", name: "Administrador", email: "admin@pelgy" };
        }
        return null;
      },
    }),
  ],

  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 horas (un turno de feria)
  },

  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
