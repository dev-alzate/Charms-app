import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-cream-100">
      <div className="w-full max-w-sm flex flex-col gap-12">
        {/* Logo */}
        <div className="flex justify-center">
          <Image
            src="/logo.svg"
            alt="PELGY — Desde 1995"
            width={260}
            height={160}
            priority
            className="w-56 h-auto"
          />
        </div>

        {/* Ornamento divisorio */}
        <div className="divider-ornament">
          <span className="font-serif italic text-sm">
            joyería personalizada
          </span>
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-3">
          <Link
            href="/sale"
            className="btn-primary py-5 text-center text-base"
          >
            Iniciar venta
          </Link>

          <Link
            href="/admin"
            className="btn-secondary py-4 text-center text-sm"
          >
            Administración
          </Link>
        </div>

        {/* Pie de pantalla */}
        <p className="eyebrow text-center mt-8">
          Sistema de feria
        </p>
      </div>
    </main>
  );
}
