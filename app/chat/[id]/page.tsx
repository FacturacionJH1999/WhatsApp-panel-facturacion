import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    .select("id, contacto_id, ultima_actividad")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Error cargando conversación:", error);
    return null;
  }

  if (!data) {
    return null;
  }

  const { data: contacto, error: errorContacto } = await supabaseAdmin
    .from("contactos")
    .select("telefono, nombre")
    .eq("id", data.contacto_id)
    .maybeSingle();

  if (errorContacto) {
    console.error("Error cargando contacto:", errorContacto);
  }

  return {
    id: data.id,
    ultima_actividad: data.ultima_actividad,
    contactos: contacto
      ? {
          telefono: contacto.telefono,
          nombre: contacto.nombre,
        }
      : null,
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

function obtenerEtiquetaTipoMensaje(mensaje: Mensaje) {
  switch (mensaje.tipo) {
    case "text":
      return "Texto";
    case "document":
      return "Documento";
    case "image":
      return "Imagen";
    case "video":
      return "Video";
    case "audio":
      return "Audio";
    default:
      return mensaje.tipo || "Mensaje";
  }
}

function obtenerContenidoMensaje(mensaje: Mensaje) {
  if (mensaje.tipo === "text" && mensaje.texto) {
    return <p className="mt-1 whitespace-pre-wrap text-sm">{mensaje.texto}</p>;
  }

  if (mensaje.tipo === "document") {
    return (
      <div className="mt-2 rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm">
        <p className="font-medium">
          📄 {mensaje.nombre_archivo || "Documento recibido"}
        </p>
        {mensaje.mime_type ? (
          <p className="mt-1 text-xs opacity-70">{mensaje.mime_type}</p>
        ) : null}
      </div>
    );
  }

  if (mensaje.tipo === "image") {
    return (
      <div className="mt-2 rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm">
        📷 Imagen recibida
      </div>
    );
  }

  if (mensaje.tipo === "video") {
    return (
      <div className="mt-2 rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm">
        🎥 Video recibido
      </div>
    );
  }

  if (mensaje.tipo === "audio") {
    return (
      <div className="mt-2 rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm">
        🎙️ Audio recibido
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm">
      Mensaje recibido
    </div>
  );
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
            prefetch={false}
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
                      {obtenerEtiquetaTipoMensaje(mensaje)}
                    </p>

                    {obtenerContenidoMensaje(mensaje)}

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
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Escribe un mensaje..."
              className="flex-1 rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none"
              disabled
            />
            <button
              type="button"
              className="rounded-xl bg-neutral-900 px-4 py-3 text-sm font-medium text-white opacity-60"
              disabled
            >
              Enviar
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}