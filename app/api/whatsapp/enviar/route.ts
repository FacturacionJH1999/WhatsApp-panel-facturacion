import { NextResponse } from "next/server";
import { guardarMensajeSaliente } from "@/lib/whatsapp/guardarMensajeSaliente";
import { getUserProfile } from "@/lib/auth/getUserProfile";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const API_KEY_GLOBAL = process.env.D360_API_KEY;

type TipoMensajeSaliente = "text" | "image" | "video" | "document";

function intentarParsearJson(texto: string) {
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

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

    const body = await req.json();

    const telefono = String(body?.telefono ?? "").trim();
    const conversacionId = String(body?.conversacionId ?? "").trim();
    const texto = typeof body?.texto === "string" ? body.texto : "";
    const tipo: TipoMensajeSaliente =
      body?.tipo === "image" ||
      body?.tipo === "video" ||
      body?.tipo === "document"
        ? body.tipo
        : "text";

    const mediaId = typeof body?.mediaId === "string" ? body.mediaId : null;
    const mimeType =
      typeof body?.mimeType === "string" ? body.mimeType : null;
    const nombreArchivo =
      typeof body?.nombreArchivo === "string" ? body.nombreArchivo : null;

    if (!telefono) {
      return NextResponse.json(
        { ok: false, error: "telefono es requerido" },
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
      .select("id, contacto_id, numero_whatsapp_id")
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
        .select(
          "id, phone_number_id, numero, nombre_interno, activo, api_key"
        )
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

    const apiKey =
      typeof numeroWhatsapp.api_key === "string" &&
      numeroWhatsapp.api_key.trim().length > 0
        ? numeroWhatsapp.api_key.trim()
        : API_KEY_GLOBAL?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "No hay API key configurada para este número de WhatsApp",
        },
        { status: 500 }
      );
    }

    let payload: Record<string, unknown>;

    if (tipo === "text") {
      if (!texto.trim()) {
        return NextResponse.json(
          { ok: false, error: "texto es requerido" },
          { status: 400 }
        );
      }

      payload = {
        messaging_product: "whatsapp",
        to: telefono,
        type: "text",
        text: {
          body: texto.trim(),
        },
      };
    } else if (tipo === "image") {
      if (!mediaId) {
        return NextResponse.json(
          { ok: false, error: "mediaId es requerido para imagen" },
          { status: 400 }
        );
      }

      payload = {
        messaging_product: "whatsapp",
        to: telefono,
        type: "image",
        image: {
          id: mediaId,
        },
      };
    } else if (tipo === "video") {
      if (!mediaId) {
        return NextResponse.json(
          { ok: false, error: "mediaId es requerido para video" },
          { status: 400 }
        );
      }

      payload = {
        messaging_product: "whatsapp",
        to: telefono,
        type: "video",
        video: {
          id: mediaId,
        },
      };
    } else {
      if (!mediaId) {
        return NextResponse.json(
          { ok: false, error: "mediaId es requerido para documento" },
          { status: 400 }
        );
      }

      payload = {
        messaging_product: "whatsapp",
        to: telefono,
        type: "document",
        document: {
          id: mediaId,
          filename: nombreArchivo ?? "archivo",
        },
      };
    }

    const response = await fetch("https://waba-v2.360dialog.io/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "D360-API-KEY": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const textoRespuesta = await response.text();
    const data = textoRespuesta ? intentarParsearJson(textoRespuesta) : null;

    if (!response.ok) {
      console.error("360dialog respondió con error:", {
        status: response.status,
        statusText: response.statusText,
        body: textoRespuesta,
        conversacionId,
        numeroWhatsappId: numeroWhatsapp.id,
        phoneNumberId: numeroWhatsapp.phone_number_id,
        numero: numeroWhatsapp.numero,
        tokenTerminacion: apiKey.slice(-6),
      });

      return NextResponse.json(
        {
          ok: false,
          error: "Error enviando mensaje",
          status: response.status,
          detalle: data ?? textoRespuesta ?? null,
        },
        { status: response.status }
      );
    }

    const waMessageId =
      data && typeof data === "object"
        ? (data as { messages?: Array<{ id?: string }> }).messages?.[0]?.id ??
          null
        : null;

    const fechaMensaje = new Date().toISOString();

    await guardarMensajeSaliente({
      telefono,
      conversacionId,
      numeroWhatsappId: numeroWhatsapp.id,
      texto:
        tipo === "text"
          ? texto.trim()
          : tipo === "image"
            ? "📷 Imagen enviada"
            : tipo === "video"
              ? "🎥 Video enviado"
              : `📄 ${nombreArchivo ?? "Documento enviado"}`,
      waMessageId,
      fechaMensaje,
      tipo,
      mimeType,
      nombreArchivo,
      mediaId,
    });

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    console.error("Error enviando mensaje:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Error enviando mensaje",
        detalle:
          error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}