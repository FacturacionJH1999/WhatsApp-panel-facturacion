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
    console.error("Error cargando asignaciones de conversaciones:", errorAsignaciones);
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

  const conversaciones: ConversacionBase[] = (data ?? []).map((conversacion) => ({
    id: conversacion.id,
    contacto_id: conversacion.contacto_id,
    ultima_actividad: conversacion.ultima_actividad,
    mensajes_no_leidos: conversacion.mensajes_no_leidos ?? 0,
    estado: (conversacion.estado as EstadoConversacion) ?? "nueva",
  }));

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
    <main className="min-h-screen bg-neutral-100">
      <AutoRefreshHome intervaloMs={3000} />

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

          <div className="px-3 pt-3">
            <form method="GET" className="space-y-2">
              {estadoFiltro !== "todas" ? (
                <input type="hidden" name="estado" value={estadoFiltro} />
              ) : null}

              <div className="flex gap-2">
                <input
                  type="text"
                  name="q"
                  defaultValue={busqueda}
                  placeholder="Buscar cliente o teléfono"
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-black"
                />

                <button
                  type="submit"
                  className="rounded-xl border border-black bg-black px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  Buscar
                </button>
              </div>

              {busqueda.trim() ? (
                <div className="flex justify-end">
                  <Link
                    href={construirHrefLimpiar(estadoFiltro)}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                  >
                    Limpiar
                  </Link>
                </div>
              ) : null}
            </form>
          </div>

          <div className="flex flex-wrap gap-2 px-3 pb-3 pt-3 text-xs font-medium">
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

          <div className="space-y-3 p-3">
            {conversaciones.length === 0 ? (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-sm font-medium text-neutral-700">
                  No hay conversaciones disponibles
                </p>
                <p className="mt-1 text-sm text-neutral-500">
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

                      <p className="mt-1 text-[11px] text-neutral-500">
                        Asignado a:{" "}
                        <span className="font-medium text-neutral-700">
                          {conversacion.asignadoA || "Sin asignar"}
                        </span>
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