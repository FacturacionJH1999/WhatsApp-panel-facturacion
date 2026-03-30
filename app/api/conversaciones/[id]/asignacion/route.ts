import { NextResponse } from "next/server";
import { getUserProfile } from "@/lib/auth/getUserProfile";
import { puedeVerConversacion } from "@/lib/auth/puedeVerConversacion";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type BodyAsignacion = {
  usuarioId?: string | null;
  usuarioIds?: string[] | null;
};

function normalizarUsuarioIds(body: BodyAsignacion): string[] {
  if (Array.isArray(body.usuarioIds)) {
    return Array.from(
      new Set(
        body.usuarioIds
          .filter((valor): valor is string => typeof valor === "string")
          .map((valor) => valor.trim())
          .filter((valor) => valor.length > 0)
      )
    );
  }

  if (typeof body.usuarioId === "string" && body.usuarioId.trim().length > 0) {
    return [body.usuarioId.trim()];
  }

  return [];
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, perfil } = await getUserProfile();

    if (!user || !perfil) {
      return NextResponse.json(
        { ok: false, error: "No autorizado." },
        { status: 401 }
      );
    }

    if (perfil.rol !== "admin") {
      return NextResponse.json(
        {
          ok: false,
          error: "Solo un administrador puede reasignar conversaciones.",
        },
        { status: 403 }
      );
    }

    const { id: conversacionId } = await context.params;

    if (!conversacionId) {
      return NextResponse.json(
        { ok: false, error: "ID de conversación inválido." },
        { status: 400 }
      );
    }

    let body: BodyAsignacion = {};

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "El cuerpo de la solicitud no es válido." },
        { status: 400 }
      );
    }

    const usuarioIds = normalizarUsuarioIds(body);

    const tieneAcceso = await puedeVerConversacion(
      {
        id: perfil.id,
        rol: perfil.rol,
      },
      conversacionId
    );

    if (!tieneAcceso) {
      return NextResponse.json(
        { ok: false, error: "No tienes acceso a esta conversación." },
        { status: 403 }
      );
    }

    if (usuarioIds.length > 0) {
      const { data: perfilesDestino, error: errorPerfilesDestino } =
        await supabaseAdmin
          .from("perfiles")
          .select("id, activo, rol")
          .in("id", usuarioIds);

      if (errorPerfilesDestino) {
        console.error("Error consultando perfiles destino:", errorPerfilesDestino);
        return NextResponse.json(
          { ok: false, error: "No se pudo validar los usuarios seleccionados." },
          { status: 500 }
        );
      }

      const perfilesValidos = (perfilesDestino ?? []).filter(
        (perfilDestino) => perfilDestino.activo && perfilDestino.rol === "empleado"
      );

      if (perfilesValidos.length !== usuarioIds.length) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Uno o más usuarios seleccionados no son válidos o no son empleados activos.",
          },
          { status: 400 }
        );
      }
    }

    const { error: errorEliminar } = await supabaseAdmin
      .from("conversaciones_asignadas")
      .delete()
      .eq("conversacion_id", conversacionId);

    if (errorEliminar) {
      console.error("Error eliminando asignaciones previas:", errorEliminar);
      return NextResponse.json(
        { ok: false, error: "No se pudo actualizar la asignación." },
        { status: 500 }
      );
    }

    if (usuarioIds.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const filasAInsertar = usuarioIds.map((usuarioId) => ({
      conversacion_id: conversacionId,
      usuario_id: usuarioId,
    }));

    const { error: errorInsertar } = await supabaseAdmin
      .from("conversaciones_asignadas")
      .insert(filasAInsertar);

    if (errorInsertar) {
      console.error("Error insertando nuevas asignaciones:", errorInsertar);
      return NextResponse.json(
        { ok: false, error: "No se pudieron guardar las nuevas asignaciones." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error en PATCH /api/conversaciones/[id]/asignacion:", error);
    return NextResponse.json(
      { ok: false, error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}