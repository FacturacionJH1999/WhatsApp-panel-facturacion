import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ConversacionLista = {
  id: string;
  ultima_actividad: string;
  contactos: {
    telefono: string;
    nombre: string | null;
  } | null;
};

async function obtenerConversaciones(): Promise<ConversacionLista[]> {
  const { data, error } = await supabaseAdmin
    .from("conversaciones")
    .select(`
      id,
      ultima_actividad,
      contactos (
        telefono,
        nombre
      )
    `)
    .order("ultima_actividad", { ascending: false });

  if (error) {
    console.error("Error cargando conversaciones:", error);
    return [];
  }

  if (!data) {
    return [];
  }

  return data.map((item) => ({
    id: item.id,
    ultima_actividad: item.ultima_actividad,
    contactos: Array.isArray(item.contactos)
      ? item.contactos[0] ?? null
      : item.contactos ?? null,
  }));
}

function formatearFecha(fechaIso: string) {
  const fecha = new Date(fechaIso);

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(fecha);
}

export default async function Home() {
  const conversaciones = await obtenerConversaciones();

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

          <div className="space-y-3 p-3">
            {conversaciones.length === 0 ? (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-sm font-medium text-neutral-700">
                  Aún no hay conversaciones
                </p>
                <p className="mt-1 text-sm text-neutral-500">
                  Cuando entren mensajes por WhatsApp aparecerán aquí.
                </p>
              </div>
            ) : (
              conversaciones.map((conversacion) => (
                <div
                  key={conversacion.id}
                  className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">
                        {conversacion.contactos?.nombre?.trim() ||
                          conversacion.contactos?.telefono ||
                          "Sin nombre"}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {conversacion.contactos?.telefono || "Sin teléfono"}
                      </p>
                    </div>

                    <p className="text-[11px] text-neutral-400">
                      {formatearFecha(conversacion.ultima_actividad)}
                    </p>
                  </div>
                </div>
              ))
            )}
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
          </div>
        </section>
      </div>
    </main>
  );
}