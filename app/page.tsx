import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/auth/requireUser";
import { AutoRefreshHome } from "./AutoRefreshHome";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RolUsuario = "admin" | "empleado";
type EstadoConversacion = "nueva" | "en_proceso" | "cerrada";

type ConversacionBase = {
  id: string;
  contacto_id: string | null;
  ultima_actividad: string;
  mensajes_no_leidos: number;
  estado: EstadoConversacion;
};

type ConversacionLista = {
  id: string;
  ultima_actividad: string;
  mensajes_no_leidos: number;
  estado: EstadoConversacion;
  asignadoA: string | null;
  contactos: {
    telefono: string;
    nombre: string | null;
  } | null;
};

type ConteosEstado = {
  todas: number;
  nueva: number;
  en_proceso: number;
  cerrada: number;
};

type ContactoMapa = {
  telefono: string;
  nombre: string | null;
};

async function obtenerIdsPermitidos(
  usuarioId: string,
  rol: RolUsuario
): Promise<string[] | null> {
  if (rol === "admin") {
    return null;
  }

  const { data: asignaciones, error } = await supabaseAdmin
    .from("conversaciones_asignadas")
    .select("conversacion_id")
    .eq("usuario_id", usuarioId);

  if (error) {
    console.error("Error cargando asignaciones:", error);
    return [];
  }

  return (asignaciones ?? [])
    .map((item) => item.conversacion_id)
    .filter(Boolean);
}

async function obtenerContactosMapeados(conversaciones: ConversacionBase[]) {
  const contactoIds = conversaciones
    .map((conversacion) => conversacion.contacto_id)
    .filter(Boolean);

  if (contactoIds.length === 0) {
    return new Map<string, ContactoMapa>();
  }

  const { data: contactos, error } = await supabaseAdmin
    .from("contactos")
    .select("id, telefono, nombre")
    .in("id", contactoIds);

  if (error) {
    console.error("Error cargando contactos:", error);
    return new Map<string, ContactoMapa>();
  }

  return new Map<string, ContactoMapa>(
    (contactos ?? []).map((contacto) => [
      contacto.id,
      {
        telefono: contacto.telefono,
        nombre: contacto.nombre,
      },
    ])
  );
}

async function obtenerAsignacionesMapeadas(conversaciones: ConversacionBase[]) {
  const conversacionIds = conversaciones.map((conversacion) => conversacion.id);

  if (conversacionIds.length === 0) {
    return new Map<string, string>();
  }

  const { data: asignaciones, error: errorAsignaciones } = await supabaseAdmin
    .from("conversaciones_asignadas")
    .select("conversacion_id, usuario_id")
    .in("conversacion_id", conversacionIds);

  if (errorAsignaciones) {
    console.error(
      "Error cargando asignaciones de conversaciones:",
      errorAsignaciones
    );
    return new Map<string, string>();
  }

  const usuarioIds = Array.from(
    new Set(
      (asignaciones ?? [])
        .map((asignacion) => asignacion.usuario_id)
        .filter(Boolean)
    )
  );

  if (usuarioIds.length === 0) {
    return new Map<string, string>();
  }

  const { data: perfiles, error: errorPerfiles } = await supabaseAdmin
    .from("perfiles")
    .select("id, nombre, email")
    .in("id", usuarioIds);

  if (errorPerfiles) {
    console.error("Error cargando perfiles asignados:", errorPerfiles);
    return new Map<string, string>();
  }

  const mapaPerfiles = new Map(
    (perfiles ?? []).map((perfil) => [
      perfil.id,
      perfil.nombre?.trim() || perfil.email || "Usuario",
    ])
  );

  const mapaAsignaciones = new Map<string, string>();

  for (const asignacion of asignaciones ?? []) {
    if (!asignacion.conversacion_id || !asignacion.usuario_id) {
      continue;
    }

    if (mapaAsignaciones.has(asignacion.conversacion_id)) {
      continue;
    }

    const nombreAsignado =
      mapaPerfiles.get(asignacion.usuario_id) ?? "Usuario";

    mapaAsignaciones.set(asignacion.conversacion_id, nombreAsignado);
  }

  return mapaAsignaciones;
}

function normalizarTexto(valor: string) {
  return valor.trim().toLowerCase();
}

function cumpleBusqueda(
  conversacion: ConversacionBase,
  mapaContactos: Map<string, ContactoMapa>,
  busqueda?: string
) {
  if (!busqueda) {
    return true;
  }

  const termino = normalizarTexto(busqueda);

  if (!termino) {
    return true;
  }

  const contacto = conversacion.contacto_id
    ? mapaContactos.get(conversacion.contacto_id) ?? null
    : null;

  const nombre = normalizarTexto(contacto?.nombre ?? "");
  const telefono = normalizarTexto(contacto?.telefono ?? "");

  return nombre.includes(termino) || telefono.includes(termino);
}

async function obtenerConversaciones(
  conversacionesIdsPermitidas: string[] | null,
  estadoFiltro?: string,
  busqueda?: string
): Promise<ConversacionLista[]> {
  if (conversacionesIdsPermitidas && conversacionesIdsPermitidas.length === 0) {
    return [];
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

  const { data, error } = await consulta;

  if (error) {
    console.error("Error cargando conversaciones:", error);
    return [];
  }

  const conversaciones: ConversacionBase[] = (data ?? []).map(
    (conversacion) => ({
      id: conversacion.id,
      contacto_id: conversacion.contacto_id,
      ultima_actividad: conversacion.ultima_actividad,
      mensajes_no_leidos: conversacion.mensajes_no_leidos ?? 0,
      estado: (conversacion.estado as EstadoConversacion) ?? "nueva",
    })
  );

  if (conversaciones.length === 0) {
    return [];
  }

  const mapaContactos = await obtenerContactosMapeados(conversaciones);
  const mapaAsignaciones = await obtenerAsignacionesMapeadas(conversaciones);

  const conversacionesFiltradas = conversaciones.filter((conversacion) =>
    cumpleBusqueda(conversacion, mapaContactos, busqueda)
  );

  return conversacionesFiltradas.map((conversacion) => ({
    id: conversacion.id,
    ultima_actividad: conversacion.ultima_actividad,
    mensajes_no_leidos: conversacion.mensajes_no_leidos,
    estado: conversacion.estado,
    asignadoA: mapaAsignaciones.get(conversacion.id) ?? null,
    contactos: conversacion.contacto_id
      ? mapaContactos.get(conversacion.contacto_id) ?? null
      : null,
  }));
}

async function obtenerConteosEstados(
  conversacionesIdsPermitidas: string[] | null,
  busqueda?: string
): Promise<ConteosEstado> {
  if (conversacionesIdsPermitidas && conversacionesIdsPermitidas.length === 0) {
    return {
      todas: 0,
      nueva: 0,
      en_proceso: 0,
      cerrada: 0,
    };
  }

  let consulta = supabaseAdmin
    .from("conversaciones")
    .select("id, contacto_id, estado");

  if (conversacionesIdsPermitidas) {
    consulta = consulta.in("id", conversacionesIdsPermitidas);
  }

  const { data, error } = await consulta;

  if (error) {
    console.error("Error cargando conteos de estados:", error);
    return {
      todas: 0,
      nueva: 0,
      en_proceso: 0,
      cerrada: 0,
    };
  }

  const conversaciones = (data ?? []).map((conversacion) => ({
    id: conversacion.id,
    contacto_id: conversacion.contacto_id,
    estado: (conversacion.estado as EstadoConversacion) ?? "nueva",
    ultima_actividad: "",
    mensajes_no_leidos: 0,
  }));

  const mapaContactos = await obtenerContactosMapeados(conversaciones);

  const conversacionesFiltradas = conversaciones.filter((conversacion) =>
    cumpleBusqueda(conversacion, mapaContactos, busqueda)
  );

  const conteos: ConteosEstado = {
    todas: 0,
    nueva: 0,
    en_proceso: 0,
    cerrada: 0,
  };

  for (const conversacion of conversacionesFiltradas) {
    conteos.todas += 1;

    if (conversacion.estado === "nueva") {
      conteos.nueva += 1;
    } else if (conversacion.estado === "en_proceso") {
      conteos.en_proceso += 1;
    } else if (conversacion.estado === "cerrada") {
      conteos.cerrada += 1;
    }
  }

  return conteos;
}

function formatearFecha(fechaIso: string) {
  const fecha = new Date(fechaIso);

  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
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
      return "border border-sky-200 bg-sky-50 text-sky-700";
    case "en_proceso":
      return "border border-amber-200 bg-amber-50 text-amber-700";
    case "cerrada":
      return "border border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border border-slate-200 bg-slate-50 text-slate-700";
  }
}

function obtenerClasesFiltro(activo: boolean) {
  return activo
    ? "rounded-full border border-teal-700 bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
    : "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50";
}

function construirHrefFiltro(estado: string, busqueda: string) {
  const params = new URLSearchParams();

  if (estado !== "todas") {
    params.set("estado", estado);
  }

  if (busqueda.trim()) {
    params.set("q", busqueda.trim());
  }

  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function construirHrefLimpiar(estado: string) {
  if (estado && estado !== "todas") {
    return `/?estado=${encodeURIComponent(estado)}`;
  }

  return "/";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  const { perfil } = await requireUser();
  const { estado, q } = await searchParams;

  const estadoFiltro = estado ?? "todas";
  const busqueda = q ?? "";

  const conversacionesIdsPermitidas = await obtenerIdsPermitidos(
    perfil.id,
    perfil.rol
  );

  const [conversaciones, conteos] = await Promise.all([
    obtenerConversaciones(conversacionesIdsPermitidas, estadoFiltro, busqueda),
    obtenerConteosEstados(conversacionesIdsPermitidas, busqueda),
  ]);

  return (
    <main className="min-h-screen bg-transparent">
      <AutoRefreshHome intervaloMs={3000} />

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-4 md:flex-row md:px-6 md:py-6">
        <aside className="superficie-premium w-full overflow-hidden rounded-[28px] md:w-[370px] md:min-w-[370px]">
          <div className="border-b border-slate-200/80 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Panel principal
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  Panel de WhatsApp
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {perfil.rol === "admin"
                    ? "Conversaciones y facturas recibidas del negocio."
                    : "Conversaciones asignadas para supervisión."}
                </p>
              </div>

              <a
                href="/logout"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                Salir
              </a>
            </div>

            <div className="mt-5 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">
                {perfil.nombre || perfil.email || "Usuario"}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Rol: {perfil.rol}
              </p>
            </div>

            {perfil.rol === "admin" ? (
              <div className="mt-4 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Administración
                </p>

                <div className="mt-3">
                  <Link
                    href="/admin/usuarios"
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
                  >
                    Administrar usuarios
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-b border-slate-200/80 p-4">
            <form method="GET" className="space-y-3">
              {estadoFiltro !== "todas" ? (
                <input type="hidden" name="estado" value={estadoFiltro} />
              ) : null}

              <div className="flex gap-2">
                <input
                  type="text"
                  name="q"
                  defaultValue={busqueda}
                  placeholder="Buscar cliente o teléfono"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-700"
                />

                <button
                  type="submit"
                  className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  Buscar
                </button>
              </div>

              {busqueda.trim() ? (
                <div className="flex justify-end">
                  <Link
                    href={construirHrefLimpiar(estadoFiltro)}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Limpiar búsqueda
                  </Link>
                </div>
              ) : null}
            </form>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-slate-200/80 px-4 py-4">
            <Link
              href={construirHrefFiltro("todas", busqueda)}
              className={obtenerClasesFiltro(estadoFiltro === "todas")}
            >
              Todas ({conteos.todas})
            </Link>

            <Link
              href={construirHrefFiltro("nueva", busqueda)}
              className={obtenerClasesFiltro(estadoFiltro === "nueva")}
            >
              Nuevas ({conteos.nueva})
            </Link>

            <Link
              href={construirHrefFiltro("en_proceso", busqueda)}
              className={obtenerClasesFiltro(estadoFiltro === "en_proceso")}
            >
              En proceso ({conteos.en_proceso})
            </Link>

            <Link
              href={construirHrefFiltro("cerrada", busqueda)}
              className={obtenerClasesFiltro(estadoFiltro === "cerrada")}
            >
              Cerradas ({conteos.cerrada})
            </Link>
          </div>

          <div className="space-y-3 p-4">
            {conversaciones.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-800">
                  No hay conversaciones disponibles
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {busqueda.trim()
                    ? "No encontramos resultados para esa búsqueda."
                    : perfil.rol === "admin"
                      ? "Cuando entren mensajes por WhatsApp aparecerán aquí."
                      : "Todavía no te han asignado conversaciones."}
                </p>
              </div>
            ) : (
              conversaciones.map((conversacion) => (
                <Link
                  key={conversacion.id}
                  href={`/chat/${conversacion.id}`}
                  className="block rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="max-w-full truncate text-sm font-semibold text-slate-900">
                          {conversacion.contactos?.nombre?.trim() ||
                            conversacion.contactos?.telefono ||
                            "Sin nombre"}
                        </p>

                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${obtenerClasesEstado(
                            conversacion.estado
                          )}`}
                        >
                          {obtenerTextoEstado(conversacion.estado)}
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-slate-500">
                        {conversacion.contactos?.telefono || "Sin teléfono"}
                      </p>

                      <p className="mt-2 text-[11px] text-slate-500">
                        Asignado a:{" "}
                        <span className="font-semibold text-slate-700">
                          {conversacion.asignadoA || "Sin asignar"}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <p className="text-[11px] text-slate-400">
                        {formatearFecha(conversacion.ultima_actividad)}
                      </p>

                      {conversacion.mensajes_no_leidos > 0 ? (
                        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
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

        <section className="flex flex-1 items-center justify-center">
          <div className="superficie-premium w-full max-w-2xl rounded-[32px] p-8 text-center md:p-12">
            <div className="mx-auto max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Centro de control
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                Bienvenido al panel
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-500 md:text-base">
                {perfil.rol === "admin"
                  ? "Aquí podrás ver y administrar todas las conversaciones del negocio desde una interfaz más clara, ordenada y profesional."
                  : "Aquí podrás supervisar únicamente las conversaciones que te hayan sido asignadas dentro del panel."}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}