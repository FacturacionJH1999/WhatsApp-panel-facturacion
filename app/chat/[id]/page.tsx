import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Mensaje = {
  id: string;
  direccion: "entrante" | "saliente";
  tipo: string;
  texto: string | null;
  nombre_archivo: string | null;
  mime_type: string | null;
  url_archivo: string | null;
  fecha_mensaje: string | null;
};

type ConversacionDetalle = {
  id: string;
  ultima_actividad: string;
  contactos: {
    telefono: string;
    nombre: string | null;
  } | null;
};

async function obtenerConversacion(id: string): Promise<ConversacionDetalle | null> {
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
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Error cargando conversación:", error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    ultima_actividad: data.ultima_actividad,
    contactos: Array.isArray(data.contactos)
      ? data.contactos[0] ?? null
      : data.contactos ?? null,
  };
}

async function obtenerMensajes(conversacionId: string): Promise<Mensaje[]> {
  const { data, error } = await supabaseAdmin
    .from("mensajes")
    .select(`
      id,
      direccion,
      tipo,
      texto,
      nombre_archivo,
      mime_type,
      url_archivo,
      fecha_mensaje
    `)
    .eq("conversacion_id", conversacionId)
    .order("fecha_mensaje", { ascending: true });

  if (error) {
    console.error("Error cargando mensajes:", error);
    return [];
  }

  return data ?? [];
}

function formatearHora(fechaIso: string | null) {
  if (!fechaIso) return "";

  return new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(fechaIso));
}

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const conversacion = await obtenerConversacion(id);

  if (!conversacion) {
    notFound();
  }

  const mensajes = await obtenerMensajes(id);

  return (
    <main className="min-h-screen bg-neutral-100">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col bg-white">
        <header className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3">
          <Link
            href="/"
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Volver
          </Link>

          <div>
            <h1 className="text-sm font-semibold text-neutral-900">
              {conversacion.contactos?.nombre?.trim() ||
                conversacion.contactos?.telefono ||
                "Sin nombre"}
            </h1>
            <p className="text-xs text-neutral-500">
              {conversacion.contactos?.telefono || "Sin teléfono"}
            </p>
          </div>
        </header>

        <section className="flex-1 space-y-3 bg-neutral-50 p-4">
          {mensajes.length === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
              Esta conversación todavía no tiene mensajes.
            </div>
          ) : (
            mensajes.map((mensaje) => {
              const esEntrante = mensaje.direccion === "entrante";

              return (
                <div
                  key={mensaje.id}
                  className={`flex ${esEntrante ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                      esEntrante
                        ? "bg-white text-neutral-900"
                        : "bg-neutral-900 text-white"
                    }`}
                  >
                    <p className="text-xs opacity-70">
                      {mensaje.tipo.toUpperCase()}
                    </p>

                    {mensaje.texto ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm">
                        {mensaje.texto}
                      </p>
                    ) : null}

                    {mensaje.nombre_archivo ? (
                      <p className="mt-2 text-sm">
                        Archivo: {mensaje.nombre_archivo}
                      </p>
                    ) : null}

                    <p className="mt-2 text-[11px] opacity-60">
                      {formatearHora(mensaje.fecha_mensaje)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </section>

        <footer className="border-t border-neutral-200 bg-white p-3">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-400">
            Aquí luego pondremos la caja para responder mensajes.
          </div>
        </footer>
      </div>
    </main>
  );
}