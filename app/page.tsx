import Link from "next/link";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME ?? "Charms App";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-neutral-50 to-neutral-100">
      <div className="w-full max-w-md flex flex-col gap-8">
        <div className="text-center">
          <div className="text-6xl mb-3">💎</div>
          <h1 className="text-3xl font-bold tracking-tight">{businessName}</h1>
          <p className="text-neutral-500 mt-2">Sistema de venta en feria</p>
        </div>

        <div className="flex flex-col gap-4">
          <Link
            href="/sale"
            className="btn-primary text-xl py-6 text-center"
            aria-label="Iniciar venta"
          >
            🛒 VENDER
          </Link>

          <Link
            href="/admin"
            className="btn-secondary text-base py-4 text-center"
            aria-label="Administración"
          >
            ⚙️ Administración
          </Link>
        </div>

        <p className="text-xs text-neutral-400 text-center mt-4">
          PWA optimizada para tablet y celular
        </p>
      </div>
    </main>
  );
}
