import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col md:flex-row">
        <aside className="w-full border-r border-neutral-200 bg-white md:w-80">
          <div className="border-b border-neutral-200 p-4">
            <h1 className="text-xl font-semibold text-neutral-900">
              Panel de WhatsApp
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Conversaciones y facturas recibidas
            </p>
          </div>

          <div className="p-3">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-sm font-medium text-neutral-700">
                Aún no hay conversaciones
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Cuando entren mensajes por WhatsApp aparecerán aquí.
              </p>
            </div>
          </div>
        </aside>

        <section className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center shadow-sm">
            <h2 className="text-2xl font-semibold text-neutral-900">
              Bienvenido al panel
            </h2>
            <p className="mt-3 text-sm leading-6 text-neutral-500">
              Aquí podrás ver mensajes, fotos, documentos, videos y facturas que
              lleguen al número de WhatsApp del negocio.
            </p>

            <div className="mt-6">
              <Link
                href="/api/whatsapp/webhook"
                className="inline-flex rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
              >
                Probar webhook
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}