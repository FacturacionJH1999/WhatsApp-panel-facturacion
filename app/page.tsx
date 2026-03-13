import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/auth/requireUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RolUsuario = "admin" | "empleado";
type EstadoConversacion = "nueva" | "en_proceso" | "cerrada";

type ConversacionLista = {
  id: string;
  ultima_actividad: string;
  mensajes_no_leidos: number;
  estado: EstadoConversacion;
  contactos: {
    telefono: string;
    nombre: string | null;
  } | null;
};

async function obtenerConversaciones(
  usuarioId: string,
  rol: RolUsuario,
  estadoFiltro?: string
): Promise<ConversacionLista[]> {
  let conversacionesIdsPermitidas: string[] | null = null;

  if (rol !== "admin") {
    const { data: asignaciones, error: errorAsignaciones } = await supabaseAdmin
      .from("conversaciones_asignadas")
      .select("conversacion_id")
      .eq("usuario_id", usuarioId);

    if (errorAsignaciones) {
      console.error("Error cargando asignaciones:", errorAsignaciones);
      return [];
    }

    conversacionesIdsPermitidas = (asignaciones ?? [])
      .map((item) => item.conversacion_id)
      .filter(Boolean);

    if (conversacionesIdsPermitidas.length === 0) {
      return [];
    }
  }

  let consulta = supabaseAdmin
    .from("conversaciones")
    .select("id, contacto_id, ultima_actividad, mensajes_no_leidos, estado")
    .order("ultima_actividad", { ascending: false });

  if (conversacionesIdsPermitidas) {
    consulta = consulta.in("id", conversacionesIdsPermitidas);
  }

  if (estadoFiltro && estadoFiltro !== "todas") {
    consulta = consulta.eq("estado", estadoFiltro);
  }

  const { data: conversaciones, error: errorConversaciones } = await consulta;

  if (errorConversaciones) {
    console.error("Error cargando conversaciones:", errorConversaciones);
    return [];
  }

  if (!conversaciones || conversaciones.length === 0) {
    return [];
  }

  const contactoIds = conversaciones
    .map((conversacion) => conversacion.contacto_id)
    .filter(Boolean);

  if (contactoIds.length === 0) {
    return conversaciones.map((conversacion) => ({
      id: conversacion.id,
      ultima_actividad: conversacion.ultima_actividad,
      mensajes_no_leidos: conversacion.mensajes_no_leidos ?? 0,
      estado: (conversacion.estado as EstadoConversacion) ?? "nueva",
      contactos: null,
    }));
  }

  const { data: contactos, error: errorContactos } = await supabaseAdmin
    .from("contactos")
    .select("id, telefono, nombre")
    .in("id", contactoIds);

  if (errorContactos) {
    console.error("Error cargando contactos:", errorContactos);
    return conversaciones.map((conversacion) => ({
      id: conversacion.id,
      ultima_actividad: conversacion.ultima_actividad,
      mensajes_no_leidos: conversacion.mensajes_no_leidos ?? 0,
      estado: (conversacion.estado as EstadoConversacion) ?? "nueva",
      contactos: null,
    }));
  }

  const mapaContactos = new Map(
    (contactos ?? []).map((contacto) => [
      contacto.id,
      {
        telefono: contacto.telefono,
        nombre: contacto.nombre,
      },
    ])
  );

  return conversaciones.map((conversacion) => ({
    id: conversacion.id,
    ultima_actividad: conversacion.ultima_actividad,
    mensajes_no_leidos: conversacion.mensajes_no_leidos ?? 0,
    estado: (conversacion.estado as EstadoConversacion) ?? "nueva",
    contactos: mapaContactos.get(conversacion.contacto_id) ?? null,
  }));
}

function formatearFecha(fechaIso: string) {
  const fecha = new Date(fechaIso);

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(fecha);
}

function obtenerTextoEstado(estado: EstadoConversacion) {
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

function obtenerClasesEstado(estado: EstadoConversacion) {
  switch (estado) {
    case "nueva":
      return "bg-blue-100 text-blue-700";
    case "en_proceso":
      return "bg-amber-100 text-amber-700";
    case "cerrada":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-neutral-100 text-neutral-700";
  }
}

function obtenerClasesFiltro(activo: boolean) {
  return activo
    ? "rounded-lg border border-black bg-black px-2 py-1 text-white"
    : "rounded-lg border border-neutral-300 px-2 py-1 text-neutral-700 hover:bg-neutral-100";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { perfil } = await requireUser();
  const { estado } = await searchParams;

  const estadoFiltro = estado ?? "todas";

  const conversaciones = await obtenerConversaciones(
    perfil.id,
    perfil.rol,
    estadoFiltro
  );

  return (
    <main className="min-h-screen bg-neutral-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col md:flex-row">
        <aside className="w-full border-r border-neutral-200 bg-white md:w-80">
          <div className="border-b border-neutral-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold text-neutral-900">
                  Panel de WhatsApp
                </h1>
                <p className="mt-1 text-sm text-neutral-500">
                  {perfil.rol === "admin"
                    ? "Conversaciones y facturas recibidas"
                    : "Conversaciones asignadas para supervisión"}
                </p>
              </div>

              <a
                href="/logout"
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
              >
                Salir
              </a>
            </div>

            <div className="mt-4 rounded-xl bg-neutral-50 p-3">
              <p className="text-sm font-medium text-neutral-900">
                {perfil.nombre || perfil.email || "Usuario"}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-neutral-500">
                Rol: {perfil.rol}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 px-3 pb-3 pt-3 text-xs font-medium">
            <Link
              href="/"
              className={obtenerClasesFiltro(estadoFiltro === "todas")}
            >
              Todas
            </Link>

            <Link
              href="/?estado=nueva"
              className={obtenerClasesFiltro(estadoFiltro === "nueva")}
            >
              Nuevas
            </Link>

            <Link
              href="/?estado=en_proceso"
              className={obtenerClasesFiltro(estadoFiltro === "en_proceso")}
            >
              En proceso
            </Link>

            <Link
              href="/?estado=cerrada"
              className={obtenerClasesFiltro(estadoFiltro === "cerrada")}
            >
              Cerradas
            </Link>
          </div>

          <div className="space-y-3 p-3">
            {conversaciones.length === 0 ? (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-sm font-medium text-neutral-700">
                  No hay conversaciones disponibles
                </p>
                <p className="mt-1 text-sm text-neutral-500">
                  {perfil.rol === "admin"
                    ? "Cuando entren mensajes por WhatsApp aparecerán aquí."
                    : "Todavía no te han asignado conversaciones."}
                </p>
              </div>
            ) : (
              conversaciones.map((conversacion) => (
                <Link
                  key={conversacion.id}
                  href={`/chat/${conversacion.id}`}
                  className="block rounded-xl border border-neutral-200 bg-white p-3 shadow-sm transition hover:bg-neutral-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-neutral-900">
                          {conversacion.contactos?.nombre?.trim() ||
                            conversacion.contactos?.telefono ||
                            "Sin nombre"}
                        </p>

                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${obtenerClasesEstado(
                            conversacion.estado
                          )}`}
                        >
                          {obtenerTextoEstado(conversacion.estado)}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-neutral-500">
                        {conversacion.contactos?.telefono || "Sin teléfono"}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <p className="text-[11px] text-neutral-400">
                        {formatearFecha(conversacion.ultima_actividad)}
                      </p>

                      {conversacion.mensajes_no_leidos > 0 ? (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                          {conversacion.mensajes_no_leidos}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
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
              {perfil.rol === "admin"
                ? "Aquí podrás ver y administrar todas las conversaciones del negocio."
                : "Aquí podrás supervisar únicamente las conversaciones que te hayan sido asignadas."}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}