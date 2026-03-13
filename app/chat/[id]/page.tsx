import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { EnviarMensaje } from "./EnviarMensaje";
import { AutoRefreshChat } from "./AutoRefreshChat";
import { AutoScrollChat } from "./AutoScrollChat";
import { requireUser } from "@/lib/auth/requireUser";
import { puedeVerConversacion } from "@/lib/auth/puedeVerConversacion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;

type Mensaje = {
  id: string;
  direccion: "entrante" | "saliente";
  tipo: string;
  texto: string | null;
  nombre_archivo: string | null;
  mime_type: string | null;
  url_archivo: string | null;
  media_id: string | null;
  estado_media: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
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

async function obtenerConversacion(
  id: string
): Promise<ConversacionDetalle | null> {
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

  const { error: errorResetNoLeidos } = await supabaseAdmin
    .from("conversaciones")
    .update({
      mensajes_no_leidos: 0,
    })
    .eq("id", data.id);

  if (errorResetNoLeidos) {
    console.error("Error reseteando no leídos:", errorResetNoLeidos);
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
      media_id,
      estado_media,
      storage_bucket,
      storage_path,
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

function construirUrlPublica(bucket: string, path: string) {
  if (!URL_SUPABASE) return null;

  const ruta = path
    .split("/")
    .map((segmento) => encodeURIComponent(segmento))
    .join("/");

  return `${URL_SUPABASE}/storage/v1/object/public/${bucket}/${ruta}`;
}

function agregarVersion(url: string, mensaje: Mensaje) {
  const version = encodeURIComponent(mensaje.fecha_mensaje ?? mensaje.id);

  if (url.includes("?")) {
    return `${url}&v=${version}`;
  }

  return `${url}?v=${version}`;
}

function obtenerUrlMedia(mensaje: Mensaje) {
  const urlArchivo = mensaje.url_archivo?.trim();

  if (urlArchivo) {
    return agregarVersion(urlArchivo, mensaje);
  }

  if (mensaje.storage_bucket && mensaje.storage_path) {
    const urlConstruida = construirUrlPublica(
      mensaje.storage_bucket,
      mensaje.storage_path
    );

    if (urlConstruida) {
      return agregarVersion(urlConstruida, mensaje);
    }
  }

  return null;
}

function esPdf(mensaje: Mensaje) {
  return (
    mensaje.tipo === "document" &&
    (mensaje.mime_type === "application/pdf" ||
      mensaje.nombre_archivo?.toLowerCase().endsWith(".pdf") === true)
  );
}

function renderEstadoMedia(mensaje: Mensaje, etiqueta: string) {
  const urlDirecta = mensaje.url_archivo?.trim() || null;
  const urlConstruida =
    mensaje.storage_bucket && mensaje.storage_path
      ? construirUrlPublica(mensaje.storage_bucket, mensaje.storage_path)
      : null;

  return (
    <div className="mt-2 rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm">
      <p>{etiqueta}</p>
      <p className="mt-1 text-xs opacity-70">
        Estado: {mensaje.estado_media || "sin estado"}
      </p>

      {urlDirecta ? (
        <a
          href={agregarVersion(urlDirecta, mensaje)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block break-all text-xs underline"
        >
          Abrir url_archivo guardada
        </a>
      ) : null}

      {urlConstruida ? (
        <a
          href={agregarVersion(urlConstruida, mensaje)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block break-all text-xs underline"
        >
          Abrir URL construida desde storage
        </a>
      ) : null}
    </div>
  );
}

function obtenerContenidoMensaje(mensaje: Mensaje) {
  const mediaUrl = obtenerUrlMedia(mensaje);

  if (mensaje.tipo === "text" && mensaje.texto) {
    return <p className="mt-1 whitespace-pre-wrap text-sm">{mensaje.texto}</p>;
  }

  if (mensaje.tipo === "image") {
    if (!mediaUrl) {
      return renderEstadoMedia(mensaje, "📷 Imagen recibida");
    }

    return (
      <div className="mt-2">
        <a href={mediaUrl} target="_blank" rel="noreferrer">
          <img
            src={mediaUrl}
            alt="Imagen recibida"
            className="max-h-[420px] w-full rounded-xl border border-black/10 bg-black/5 object-contain"
          />
        </a>
      </div>
    );
  }

  if (mensaje.tipo === "video") {
    if (!mediaUrl) {
      return renderEstadoMedia(mensaje, "🎥 Video recibido");
    }

    return (
      <div className="mt-2">
        <video
          controls
          preload="metadata"
          playsInline
          className="max-h-[420px] w-full rounded-xl border border-black/10 bg-black"
        >
          <source src={mediaUrl} type={mensaje.mime_type ?? "video/mp4"} />
          Tu navegador no soporta video.
        </video>

        <a
          href={mediaUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm underline"
        >
          Abrir video en otra pestaña
        </a>
      </div>
    );
  }

  if (esPdf(mensaje)) {
    if (!mediaUrl) {
      return renderEstadoMedia(
        mensaje,
        `📄 ${mensaje.nombre_archivo || "PDF recibido"}`
      );
    }

    return (
      <div className="mt-2">
        <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
          <iframe
            src={mediaUrl}
            title={mensaje.nombre_archivo || "PDF recibido"}
            className="h-[520px] w-full"
          />
        </div>

        <a
          href={mediaUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm underline"
        >
          Abrir PDF en otra pestaña
        </a>
      </div>
    );
  }

  if (mensaje.tipo === "document") {
    if (!mediaUrl) {
      return renderEstadoMedia(
        mensaje,
        `📄 ${mensaje.nombre_archivo || "Documento recibido"}`
      );
    }

    return (
      <div className="mt-2 rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm">
        <p className="font-medium">
          📄 {mensaje.nombre_archivo || "Documento recibido"}
        </p>

        {mensaje.mime_type ? (
          <p className="mt-1 text-xs opacity-70">{mensaje.mime_type}</p>
        ) : null}

        <a
          href={mediaUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block underline"
        >
          Abrir documento
        </a>
      </div>
    );
  }

  if (mensaje.tipo === "audio") {
    if (!mediaUrl) {
      return renderEstadoMedia(mensaje, "🎙️ Audio recibido");
    }

    return (
      <div className="mt-2">
        <audio controls className="w-full">
          <source src={mediaUrl} type={mensaje.mime_type ?? "audio/mpeg"} />
          Tu navegador no soporta audio.
        </audio>

        <a
          href={mediaUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm underline"
        >
          Abrir audio en otra pestaña
        </a>
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
  const { perfil } = await requireUser();
  const { id } = await params;

  const tieneAcceso = await puedeVerConversacion(perfil, id);

  if (!tieneAcceso) {
    notFound();
  }

  const conversacion = await obtenerConversacion(id);

  if (!conversacion) {
    notFound();
  }

  const mensajes = await obtenerMensajes(id);
  const esAdmin = perfil.rol === "admin";

  return (
    <main className="h-screen overflow-hidden bg-neutral-100">
      { <AutoRefreshChat intervaloMs={3000} />}
      <AutoScrollChat />

      <div className="mx-auto flex h-screen max-w-5xl flex-col bg-white">
        <header className="shrink-0 border-b border-neutral-200 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
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
            </div>

            <div className="text-right">
              <p className="text-xs font-medium text-neutral-700">
                {perfil.nombre || perfil.email || "Usuario"}
              </p>
              <p className="text-[11px] uppercase tracking-wide text-neutral-500">
                {perfil.rol}
              </p>
            </div>
          </div>
        </header>

        <section
          id="contenedor-mensajes"
          className="min-h-0 flex-1 overflow-y-auto bg-neutral-50 p-4"
        >
          <div className="space-y-3">
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
          </div>
        </section>

        <footer className="shrink-0 border-t border-neutral-200 bg-white p-3">
          <EnviarMensaje
            telefono={conversacion.contactos?.telefono || ""}
            puedeEnviar={esAdmin}
          />
        </footer>
      </div>
    </main>
  );
}