import { NextResponse } from "next/server";
import { getUserProfile } from "@/lib/auth/getUserProfile";
import { puedeVerConversacion } from "@/lib/auth/puedeVerConversacion";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type BodyAsignacion = {
  usuarioId?: string | null;
};

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

    const usuarioId =
      typeof body?.usuarioId === "string" && body.usuarioId.trim().length > 0
        ? body.usuarioId.trim()
        : null;

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

    const { error: errorEliminar } = await supabaseAdmin
      .from("conversaciones_asignadas")
      .delete()
      .eq("conversacion_id", conversacionId);

    if (errorEliminar) {
      console.error("Error eliminando asignación previa:", errorEliminar);
      return NextResponse.json(
        { ok: false, error: "No se pudo actualizar la asignación." },
        { status: 500 }
      );
    }

    if (!usuarioId) {
      return NextResponse.json({ ok: true });
    }

    const { data: perfilDestino, error: errorPerfilDestino } =
      await supabaseAdmin
        .from("perfiles")
        .select("id, activo, rol")
        .eq("id", usuarioId)
        .maybeSingle();

    if (errorPerfilDestino) {
      console.error("Error consultando perfil destino:", errorPerfilDestino);
      return NextResponse.json(
        { ok: false, error: "No se pudo validar el usuario seleccionado." },
        { status: 500 }
      );
    }

    if (!perfilDestino || !perfilDestino.activo) {
      return NextResponse.json(
        { ok: false, error: "El usuario seleccionado no es válido." },
        { status: 400 }
      );
    }

    if (perfilDestino.rol !== "empleado") {
      return NextResponse.json(
        { ok: false, error: "Solo puedes asignar la conversación a un empleado." },
        { status: 400 }
      );
    }

    const { error: errorInsertar } = await supabaseAdmin
      .from("conversaciones_asignadas")
      .insert({
        conversacion_id: conversacionId,
        usuario_id: usuarioId,
      });

    if (errorInsertar) {
      console.error("Error insertando nueva asignación:", errorInsertar);
      return NextResponse.json(
        { ok: false, error: "No se pudo guardar la nueva asignación." },
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