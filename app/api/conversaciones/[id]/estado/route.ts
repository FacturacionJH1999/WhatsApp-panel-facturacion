import { NextResponse } from "next/server";
import { getUserProfile } from "@/lib/auth/getUserProfile";
import { puedeVerConversacion } from "@/lib/auth/puedeVerConversacion";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ESTADOS_VALIDOS = ["nueva", "en_proceso", "cerrada"] as const;

type EstadoConversacion = (typeof ESTADOS_VALIDOS)[number];

function esEstadoValido(valor: unknown): valor is EstadoConversacion {
  return (
    typeof valor === "string" &&
    ESTADOS_VALIDOS.includes(valor as EstadoConversacion)
  );
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

    const { id } = await context.params;
    const body = await request.json();
    const estado = body?.estado;

    if (!esEstadoValido(estado)) {
      return NextResponse.json(
        { ok: false, error: "Estado inválido." },
        { status: 400 }
      );
    }

    const tieneAcceso = await puedeVerConversacion(
      {
        id: perfil.id,
        rol: perfil.rol,
      },
      id
    );

    if (!tieneAcceso) {
      return NextResponse.json(
        { ok: false, error: "No tienes acceso a esta conversación." },
        { status: 403 }
      );
    }

    const { error } = await supabaseAdmin
      .from("conversaciones")
      .update({ estado })
      .eq("id", id);

    if (error) {
      console.error("Error actualizando estado de conversación:", error);
      return NextResponse.json(
        { ok: false, error: "No se pudo actualizar el estado." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error en PATCH /api/conversaciones/[id]/estado:", error);
    return NextResponse.json(
      { ok: false, error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}