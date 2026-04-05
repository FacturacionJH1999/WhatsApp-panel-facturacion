import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { EnviarMensaje } from "./EnviarMensaje";
import { AutoRefreshChat } from "./AutoRefreshChat";
import { AutoScrollChat } from "./AutoScrollChat";
import { EstadoConversacionSelector } from "./EstadoConversacionSelector";
import { AsignacionConversacionSelector } from "./AsignacionConversacionSelector";
import { EditarAliasContacto } from "./EditarAliasContacto";
import { GaleriaMultimedia, type ItemGaleria } from "./GaleriaMultimedia";
import { requireUser } from "@/lib/auth/requireUser";
import { puedeVerConversacion } from "@/lib/auth/puedeVerConversacion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const TIMEZONE_COLOMBIA = "America/Bogota";

type EstadoConversacion = "nueva" | "en_proceso" | "cerrada";

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
  estado: EstadoConversacion;
  usuariosAsignadosIds: string[];
  usuariosAsignadosNombres: string[];
  numeroWhatsappId: string | null;
  numeroWhatsappNombre: string | null;
  numeroWhatsappTelefono: string | null;
  contactos: {
    id: string;
    telefono: string;
    nombre: string | null;
    alias: string | null;
  } | null;
};

type UsuarioAsignable = {
  id: string;
  nombre: string;
};

function obtenerNombreVisibleContacto(
  contacto:
    | {
        id: string;
        telefono: string;
        nombre: string | null;
        alias: string | null;
      }
    | null
    | undefined
) {
  if (!contacto) return "Sin nombre";

  return (
    contacto.alias?.trim() ||
    contacto.nombre?.trim() ||
    contacto.telefono ||
    "Sin nombre"
  );
}

async function obtenerConversacion(
  id: string
): Promise<ConversacionDetalle | null> {
  const { data, error } = await supabaseAdmin
    .from("conversaciones")
    .select("id, contacto_id, ultima_actividad, estado, numero_whatsapp_id")
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
    .select("id, telefono, nombre, alias")
    .eq("id", data.contacto_id)
    .maybeSingle();

  if (errorContacto) {
    console.error("Error cargando contacto:", errorContacto);
  }

  let numeroWhatsappNombre: string | null = null;
  let numeroWhatsappTelefono: string | null = null;

  if (data.numero_whatsapp_id) {
    const { data: numeroWhatsapp, error: errorNumeroWhatsapp } =
      await supabaseAdmin
        .from("numeros_whatsapp")
        .select("id, nombre_interno, numero")
        .eq("id", data.numero_whatsapp_id)
        .maybeSingle();

    if (errorNumeroWhatsapp) {
      console.error("Error cargando número de WhatsApp:", errorNumeroWhatsapp);
    }

    numeroWhatsappNombre = numeroWhatsapp?.nombre_interno ?? null;
    numeroWhatsappTelefono = numeroWhatsapp?.numero ?? null;
  }

  const { data: asignaciones, error: errorAsignaciones } = await supabaseAdmin
    .from("conversaciones_asignadas")
    .select("usuario_id")
    .eq("conversacion_id", data.id);

  if (errorAsignaciones) {
    console.error("Error cargando asignaciones:", errorAsignaciones);
  }

  const usuariosAsignadosIds = Array.from(
    new Set(
      (asignaciones ?? [])
        .map((asignacion) => asignacion.usuario_id)
        .filter(
          (valor): valor is string =>
            typeof valor === "string" && valor.length > 0
        )
    )
  );

  let usuariosAsignadosNombres: string[] = [];

  if (usuariosAsignadosIds.length > 0) {
    const { data: perfilesAsignados, error: errorPerfilesAsignados } =
      await supabaseAdmin
        .from("perfiles")
        .select("id, nombre, email")
        .in("id", usuariosAsignadosIds);

    if (errorPerfilesAsignados) {
      console.error(
        "Error cargando perfiles asignados:",
        errorPerfilesAsignados
      );
    }

    const mapaPerfiles = new Map(
      (perfilesAsignados ?? []).map((perfilAsignado) => [
        perfilAsignado.id,
        perfilAsignado.nombre?.trim() || perfilAsignado.email || "Usuario",
      ])
    );

    usuariosAsignadosNombres = usuariosAsignadosIds
      .map((usuarioId) => mapaPerfiles.get(usuarioId))
      .filter((nombre): nombre is string => Boolean(nombre));
  }

  return {
    id: data.id,
    ultima_actividad: data.ultima_actividad,
    estado: (data.estado as EstadoConversacion) ?? "nueva",
    usuariosAsignadosIds,
    usuariosAsignadosNombres,
    numeroWhatsappId: data.numero_whatsapp_id ?? null,
    numeroWhatsappNombre,
    numeroWhatsappTelefono,
    contactos: contacto
      ? {
          id: contacto.id,
          telefono: contacto.telefono,
          nombre: contacto.nombre,
          alias: contacto.alias,
        }
      : null,
  };
}

async function obtenerUsuariosAsignables(): Promise<UsuarioAsignable[]> {
  const { data, error } = await supabaseAdmin
    .from("perfiles")
    .select("id, nombre, email, activo, rol")
    .eq("activo", true)
    .eq("rol", "empleado")
    .order("nombre", { ascending: true });

  if (error) {
    console.error("Error cargando usuarios asignables:", error);
    return [];
  }

  return (data ?? []).map((usuario) => ({
    id: usuario.id,
    nombre: usuario.nombre?.trim() || usuario.email || "Usuario",
  }));
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

  const fecha = new Date(fechaIso);

  if (Number.isNaN(fecha.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIMEZONE_COLOMBIA,
  }).format(fecha);
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

function construirItemsGaleria(mensajes: Mensaje[]): ItemGaleria[] {
  return mensajes
    .filter((mensaje) => mensaje.tipo === "image" || mensaje.tipo === "video")
    .map((mensaje) => {
      const url = obtenerUrlMedia(mensaje);

      if (!url) {
        return null;
      }

      return {
        id: mensaje.id,
        tipo: mensaje.tipo as "image" | "video",
        url,
        nombreArchivo: mensaje.nombre_archivo,
        mimeType: mensaje.mime_type,
        fechaMensaje: mensaje.fecha_mensaje,
      };
    })
    .filter((item): item is ItemGaleria => Boolean(item));
}

function esPdf(mensaje: Mensaje) {
  return (
    mensaje.tipo === "document" &&
    (mensaje.mime_type === "application/pdf" ||
      mensaje.nombre_archivo?.toLowerCase().endsWith(".pdf") === true)
  );
}

function obtenerClasesEstadoConversacion(estado: EstadoConversacion) {
  switch (estado) {
    case "nueva":
      return "border border-sky-200 bg-sky-50 text-sky-700";
    case "en_proceso":
      return "border border-amber-200 bg-amber-50 text-amber-700";
    case "cerrada":
      return "border border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border border-slate-200 bg-slate-50 text-slate-700";
  }
}

function obtenerTextoEstadoConversacion(estado: EstadoConversacion) {
  switch (estado) {
    case "nueva":
      return "Nueva";
    case "en_proceso":
      return "En proceso";
    case "cerrada":
      return "Cerrada";
    default:
      return estado;
  }
}

function renderEstadoMedia(mensaje: Mensaje, etiqueta: string) {
  const urlDirecta = mensaje.url_archivo?.trim() || null;
  const urlConstruida =
    mensaje.storage_bucket && mensaje.storage_path
      ? construirUrlPublica(mensaje.storage_bucket, mensaje.storage_path)
      : null;

  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <p className="font-medium text-slate-800">{etiqueta}</p>
      <p className="mt-1 text-xs text-slate-500">
        Estado: {mensaje.estado_media || "sin estado"}
      </p>

      {urlDirecta ? (
        <a
          href={agregarVersion(urlDirecta, mensaje)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block break-all text-xs font-medium text-teal-700 underline underline-offset-2"
        >
          Abrir url_archivo guardada
        </a>
      ) : null}

      {urlConstruida ? (
        <a
          href={agregarVersion(urlConstruida, mensaje)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block break-all text-xs font-medium text-teal-700 underline underline-offset-2"
        >
          Abrir URL construida desde storage
        </a>
      ) : null}
    </div>
  );
}

function obtenerContenidoMensaje(
  mensaje: Mensaje,
  itemsGaleria: ItemGaleria[]
) {
  const mediaUrl = obtenerUrlMedia(mensaje);

  if (mensaje.tipo === "text" && mensaje.texto) {
    return (
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
        {mensaje.texto}
      </p>
    );
  }

  if (mensaje.tipo === "image") {
    if (!mediaUrl) {
      return renderEstadoMedia(mensaje, "📷 Imagen recibida");
    }

    return (
      <GaleriaMultimedia
        items={itemsGaleria}
        mensajeActualId={mensaje.id}
        tipo="image"
        url={mediaUrl}
        nombreArchivo={mensaje.nombre_archivo}
        mimeType={mensaje.mime_type}
      />
    );
  }

  if (mensaje.tipo === "video") {
    if (!mediaUrl) {
      return renderEstadoMedia(mensaje, "🎥 Video recibido");
    }

    return (
      <GaleriaMultimedia
        items={itemsGaleria}
        mensajeActualId={mensaje.id}
        tipo="video"
        url={mediaUrl}
        nombreArchivo={mensaje.nombre_archivo}
        mimeType={mensaje.mime_type}
      />
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
      <div className="mt-3">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
          className="mt-3 inline-block text-sm font-medium text-teal-700 underline underline-offset-2"
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
      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-800">
          📄 {mensaje.nombre_archivo || "Documento recibido"}
        </p>

        {mensaje.mime_type ? (
          <p className="mt-1 text-xs text-slate-500">{mensaje.mime_type}</p>
        ) : null}

        <a
          href={mediaUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block font-medium text-teal-700 underline underline-offset-2"
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
      <div className="mt-3">
        <audio controls className="w-full">
          <source src={mediaUrl} type={mensaje.mime_type ?? "audio/mpeg"} />
          Tu navegador no soporta audio.
        </audio>

        <a
          href={mediaUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm font-medium text-teal-700 underline underline-offset-2"
        >
          Abrir audio en otra pestaña
        </a>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
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

  const [mensajes, usuariosAsignables] = await Promise.all([
    obtenerMensajes(id),
    perfil.rol === "admin" ? obtenerUsuariosAsignables() : Promise.resolve([]),
  ]);

  const esAdmin = perfil.rol === "admin";
  const nombreVisibleContacto = obtenerNombreVisibleContacto(
    conversacion.contactos
  );
  const itemsGaleria = construirItemsGaleria(mensajes);

  return (
    <main className="h-screen overflow-hidden bg-transparent">
      <AutoRefreshChat intervaloMs={3000} />
      <AutoScrollChat />

      <div className="mx-auto flex h-screen max-w-6xl flex-col px-3 py-3 md:px-5 md:py-5">
        <div className="superficie-premium flex h-full min-h-0 flex-col overflow-hidden rounded-[30px]">
          <header className="shrink-0 border-b border-slate-200/80 px-4 py-4 md:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex min-w-0 items-start gap-3 md:gap-4">
                <Link
                  href="/"
                  prefetch={false}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Volver
                </Link>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-lg font-semibold tracking-tight text-slate-900 md:text-xl">
                      {nombreVisibleContacto}
                    </p>

                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${obtenerClasesEstadoConversacion(
                        conversacion.estado
                      )}`}
                    >
                      {obtenerTextoEstadoConversacion(conversacion.estado)}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    {conversacion.contactos?.telefono || "Sin teléfono"}
                  </p>

                  {conversacion.contactos ? (
                    <div className="mt-2">
                      <EditarAliasContacto
                        contactoId={conversacion.contactos.id}
                        aliasActual={conversacion.contactos.alias}
                        puedeEditar={esAdmin}
                      />
                    </div>
                  ) : null}

                  {conversacion.contactos?.alias?.trim() ? (
                    <p className="mt-2 text-[12px] text-slate-500">
                      Nombre original:
                      <span className="ml-1 font-semibold text-slate-700">
                        {conversacion.contactos?.nombre?.trim() || "Sin nombre"}
                      </span>
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-col gap-1.5 text-[12px] text-slate-500">
                    <p>
                      Línea:
                      <span className="ml-1 font-semibold text-slate-700">
                        {conversacion.numeroWhatsappNombre ||
                          conversacion.numeroWhatsappTelefono ||
                          "Sin línea"}
                      </span>
                    </p>

                    <p>
                      Asignados actualmente:
                      <span className="ml-1 font-semibold text-slate-700">
                        {conversacion.usuariosAsignadosNombres.length > 0
                          ? conversacion.usuariosAsignadosNombres.join(", ")
                          : "Sin asignar"}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 xl:min-w-[320px] xl:items-end">
                <div className="flex flex-wrap items-start justify-start gap-3 xl:justify-end">
                  {esAdmin ? (
                    <AsignacionConversacionSelector
                      conversacionId={conversacion.id}
                      usuariosActualesIds={conversacion.usuariosAsignadosIds}
                      usuarios={usuariosAsignables}
                    />
                  ) : null}

                  <EstadoConversacionSelector
                    conversacionId={conversacion.id}
                    estadoActual={conversacion.estado}
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm xl:text-right">
                  <p className="text-sm font-semibold text-slate-800">
                    {perfil.nombre || perfil.email || "Usuario"}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    {perfil.rol}
                  </p>
                </div>
              </div>
            </div>
          </header>

          <section
            id="contenedor-mensajes"
            className="min-h-0 flex-1 overflow-y-auto bg-transparent px-3 py-4 md:px-5 md:py-5"
          >
            <div className="mx-auto flex max-w-4xl flex-col gap-4">
              {mensajes.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 text-sm text-slate-500 shadow-sm">
                  Esta conversación todavía no tiene mensajes.
                </div>
              ) : (
                mensajes.map((mensaje) => {
                  const esEntrante = mensaje.direccion === "entrante";

                  return (
                    <div
                      key={mensaje.id}
                      className={`flex ${
                        esEntrante ? "justify-start" : "justify-end"
                      }`}
                    >
                      <div
                        className={`max-w-[88%] rounded-[24px] border px-4 py-3 shadow-sm md:max-w-[78%] ${
                          esEntrante
                            ? "border-slate-200 bg-white text-slate-900"
                            : "border-teal-700 bg-teal-700 text-white"
                        }`}
                      >
                        <p
                          className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
                            esEntrante ? "text-slate-400" : "text-white/70"
                          }`}
                        >
                          {obtenerEtiquetaTipoMensaje(mensaje)}
                        </p>

                        {obtenerContenidoMensaje(mensaje, itemsGaleria)}

                        <p
                          className={`mt-3 text-[11px] ${
                            esEntrante ? "text-slate-400" : "text-white/70"
                          }`}
                        >
                          {formatearHora(mensaje.fecha_mensaje)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <footer className="shrink-0 border-t border-slate-200/80 bg-white/80 p-3 md:p-4">
            <div className="mx-auto max-w-4xl">
              <EnviarMensaje
                telefono={conversacion.contactos?.telefono || ""}
                conversacionId={conversacion.id}
                puedeEnviar={esAdmin}
              />
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}