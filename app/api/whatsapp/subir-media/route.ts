import { NextResponse } from "next/server";
import { getUserProfile } from "@/lib/auth/getUserProfile";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const API_KEY = process.env.D360_API_KEY;

export async function POST(req: Request) {
  try {
    const { user, perfil } = await getUserProfile();

    if (!user || !perfil) {
      return NextResponse.json(
        { ok: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    if (perfil.rol !== "admin") {
      return NextResponse.json(
        { ok: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    if (!API_KEY) {
      return NextResponse.json(
        { ok: false, error: "Falta D360_API_KEY" },
        { status: 500 }
      );
    }

    const formDataEntrada = await req.formData();
    const archivo = formDataEntrada.get("file");
    const conversacionId = String(
      formDataEntrada.get("conversacionId") ?? ""
    ).trim();

    if (!(archivo instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Archivo requerido" },
        { status: 400 }
      );
    }

    if (!conversacionId) {
      return NextResponse.json(
        { ok: false, error: "conversacionId es requerido" },
        { status: 400 }
      );
    }

    const { data: conversacion, error: errorConversacion } = await supabaseAdmin
      .from("conversaciones")
      .select("id, numero_whatsapp_id")
      .eq("id", conversacionId)
      .maybeSingle();

    if (errorConversacion) {
      console.error("Error consultando conversación:", errorConversacion);

      return NextResponse.json(
        { ok: false, error: "Error consultando conversación" },
        { status: 500 }
      );
    }

    if (!conversacion?.id) {
      return NextResponse.json(
        { ok: false, error: "Conversación no encontrada" },
        { status: 404 }
      );
    }

    if (!conversacion.numero_whatsapp_id) {
      return NextResponse.json(
        {
          ok: false,
          error: "La conversación no tiene numero_whatsapp_id asociado",
        },
        { status: 400 }
      );
    }

    const { data: numeroWhatsapp, error: errorNumeroWhatsapp } =
      await supabaseAdmin
        .from("numeros_whatsapp")
        .select("id, phone_number_id, numero, nombre_interno, activo")
        .eq("id", conversacion.numero_whatsapp_id)
        .maybeSingle();

    if (errorNumeroWhatsapp) {
      console.error("Error consultando número de WhatsApp:", errorNumeroWhatsapp);

      return NextResponse.json(
        { ok: false, error: "Error consultando número de WhatsApp" },
        { status: 500 }
      );
    }

    if (!numeroWhatsapp?.id) {
      return NextResponse.json(
        { ok: false, error: "Número de WhatsApp no encontrado" },
        { status: 404 }
      );
    }

    if (!numeroWhatsapp.activo) {
      return NextResponse.json(
        { ok: false, error: "El número de WhatsApp está inactivo" },
        { status: 400 }
      );
    }

    const formData = new FormData();
    formData.append("file", archivo, archivo.name);
    formData.append("messaging_product", "whatsapp");

    const response = await fetch("https://waba-v2.360dialog.io/media", {
      method: "POST",
      headers: {
        "D360-API-KEY": API_KEY,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Error subiendo media",
          detalle: data,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      ok: true,
      numeroWhatsappId: numeroWhatsapp.id,
      phoneNumberId: numeroWhatsapp.phone_number_id,
      ...data,
    });
  } catch (error) {
    console.error("Error subiendo media:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Error subiendo media",
        detalle:
          error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}