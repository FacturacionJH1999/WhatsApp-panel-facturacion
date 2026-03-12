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
  storage_path: string | null;
  tamano_bytes: number | null;
  fecha_mensaje: string | null;
};

type ConversacionDetalle = {
  id: string;
  contacto_id: string;
  ultima_actividad: string;
  contacto: {
    telefono: string;
    nombre: string | null;
  } | null;
};

async function obtenerConversacion(id: string): Promise<ConversacionDetalle | null> {
  const { data: conversacion, error: errorConversacion } = await supabaseAdmin
    .from("conversaciones")
    .select("id, contacto_id, ultima_actividad")
    .eq("id", id)
    .maybeSingle();

  if (errorConversacion) {
    console.error("Error cargando conversación:", errorConversacion);
    return null;
  }

  if (!conversacion) {
    return null;
  }

  const { data: contacto, error: errorContacto } = await supabaseAdmin
    .from("contactos")
    .select("telefono, nombre")
    .eq("id", conversacion.contacto_id)
    .maybeSingle();

  if (errorContacto) {
    console.error("Error cargando contacto:", errorContacto);
  }

  return {
    id: conversacion.id,
    contacto_id: conversacion.contacto_id,
    ultima_actividad: conversacion.ultima_actividad,
    contacto: contacto
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
    .select(
      "id, direccion, tipo, texto, nombre_archivo, mime_type, url_archivo, storage_path, tamano_bytes, fecha_mensaje"
    )
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

function formatearTamano(bytes: number | null) {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function obtenerEtiquetaTipoMensaje(tipo: string) {
  switch (tipo) {
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
      return tipo || "Mensaje";
  }
}

export default async function ChatPage({
  params,
}: {
  params: { id: string };
}) {
  const conversacion = await obtenerConversacion(params.id);

  if (!conversacion) {
    notFound();
  }

  const mensajes = await obtenerMensajes(conversacion.id);

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
              {conversacion.contacto?.nombre?.trim() ||
                conversacion.contacto?.telefono ||
                "Sin nombre"}
            </h1>
            <p className="text-xs text-neutral-500">
              {conversacion.contacto?.telefono || "Sin teléfono"}
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
              const tamano = formatearTamano(mensaje.tamano_bytes);
              const tieneArchivo = Boolean(mensaje.url_archivo || mensaje.storage_path);

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
                      {obtenerEtiquetaTipoMensaje(mensaje.tipo)}
                    </p>

                    {mensaje.tipo === "text" && mensaje.texto ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm">{mensaje.texto}</p>
                    ) : null}

                    {mensaje.tipo === "document" ? (
                      <div className="mt-2 rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm">
                        <p className="font-medium">
                          📄 {mensaje.nombre_archivo || "Documento recibido"}
                        </p>
                        {mensaje.mime_type ? (
                          <p className="mt-1 text-xs opacity-70">{mensaje.mime_type}</p>
                        ) : null}
                        {tamano ? (
                          <p className="mt-1 text-xs opacity-70">Tamaño: {tamano}</p>
                        ) : null}
                        {tieneArchivo ? (
                          <p className="mt-2 text-xs font-medium text-blue-600">
                            Archivo guardado en el sistema
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {mensaje.tipo === "image" ? (
                      <div className="mt-2 rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm">
                        <p>📷 Imagen recibida</p>
                        {tieneArchivo ? (
                          <p className="mt-2 text-xs font-medium text-blue-600">
                            Imagen guardada en el sistema
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {mensaje.tipo === "video" ? (
                      <div className="mt-2 rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm">
                        <p>🎥 Video recibido</p>
                        {tamano ? (
                          <p className="mt-1 text-xs opacity-70">Tamaño: {tamano}</p>
                        ) : null}
                        {tieneArchivo ? (
                          <p className="mt-2 text-xs font-medium text-blue-600">
                            Video guardado en el sistema
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {mensaje.tipo === "audio" ? (
                      <div className="mt-2 rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm">
                        <p>🎙️ Audio recibido</p>
                        {tamano ? (
                          <p className="mt-1 text-xs opacity-70">Tamaño: {tamano}</p>
                        ) : null}
                        {tieneArchivo ? (
                          <p className="mt-2 text-xs font-medium text-blue-600">
                            Audio guardado en el sistema
                          </p>
                        ) : null}
                      </div>
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