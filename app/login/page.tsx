"use client";

import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/admin";
  const [method, setMethod] = useState<"email" | "pin">("email");

  // Email + contraseña
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // PIN
  const [pin, setPin] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signIn("email", {
      email: email.trim(),
      password,
      callbackUrl,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Correo o contraseña incorrectos.");
    } else if (result?.url) {
      window.location.href = result.url;
    }
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signIn("pin", {
      pin,
      callbackUrl,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("PIN incorrecto.");
    } else if (result?.url) {
      window.location.href = result.url;
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-cream-100">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/logo.svg"
            alt="PELGY"
            width={180}
            height={110}
            className="w-40 h-auto"
            priority
          />
        </div>

        <div className="card-elevated p-8">
          <h1 className="font-serif text-2xl text-ink text-center mb-1">
            Administración
          </h1>
          <p className="text-sm text-ink-muted text-center mb-6">
            Acceso restringido
          </p>

          {/* Tabs de método */}
          <div className="flex rounded-lg overflow-hidden border border-cream-300 mb-6">
            <button
              onClick={() => { setMethod("email"); setError(null); }}
              className={`flex-1 py-2.5 text-sm transition-colors ${
                method === "email"
                  ? "bg-brand text-white"
                  : "bg-white text-ink-muted hover:text-ink"
              }`}
            >
              Correo y contraseña
            </button>
            <button
              onClick={() => { setMethod("pin"); setError(null); }}
              className={`flex-1 py-2.5 text-sm transition-colors ${
                method === "pin"
                  ? "bg-brand text-white"
                  : "bg-white text-ink-muted hover:text-ink"
              }`}
            >
              Código PIN
            </button>
          </div>

          {/* Formulario email */}
          {method === "email" && (
            <form onSubmit={handleEmailLogin} className="flex flex-col gap-3">
              <input
                className="input"
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
              <input
                className="input"
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {error && (
                <p className="text-red-700 text-sm text-center">{error}</p>
              )}
              <button
                className="btn-primary py-4 mt-1"
                type="submit"
                disabled={loading || !email || !password}
              >
                {loading ? "Verificando…" : "Ingresar"}
              </button>
            </form>
          )}

          {/* Formulario PIN */}
          {method === "pin" && (
            <form onSubmit={handlePinLogin} className="flex flex-col gap-3">
              <input
                className="input text-center text-2xl tracking-[0.5em] font-mono"
                type="password"
                inputMode="numeric"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoFocus
                required
              />
              {error && (
                <p className="text-red-700 text-sm text-center">{error}</p>
              )}
              <button
                className="btn-primary py-4 mt-1"
                type="submit"
                disabled={loading || !pin}
              >
                {loading ? "Verificando…" : "Ingresar"}
              </button>
            </form>
          )}
        </div>

        {/* Volver al inicio */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm text-ink-muted hover:text-brand-darker transition-colors"
          >
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-cream-100">
          <p className="font-serif italic text-ink-muted">Cargando…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
