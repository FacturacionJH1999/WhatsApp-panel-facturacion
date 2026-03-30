import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/auth/requireUser";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { perfil } = await requireUser();

    if (perfil.rol !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const alias = typeof body.alias === "string" ? body.alias.trim() : "";

    const { error } = await supabaseAdmin
      .from("contactos")
      .update({
        alias: alias.length > 0 ? alias : null,
      })
      .eq("id", id);

    if (error) {
      console.error("Error actualizando alias:", error);
      return NextResponse.json(
        { error: "No se pudo actualizar el alias" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error en PATCH alias:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}