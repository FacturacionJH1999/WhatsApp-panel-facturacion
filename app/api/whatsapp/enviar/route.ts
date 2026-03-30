import { NextResponse } from "next/server";
import { guardarMensajeSaliente } from "@/lib/whatsapp/guardarMensajeSaliente";
import { getUserProfile } from "@/lib/auth/getUserProfile";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_KEY_GLOBAL = process.env.D360_API_KEY;

type TipoMensajeSaliente = "text" | "image" | "video" | "document";

function intentarParsearJson(texto: string) {
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

function inferirTipoMensajeDesdeMimeType(
  mimeType: string | null | undefined
): TipoMensajeSaliente {
  if (!mimeType) return "document";

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";

  return "document";
}

async function subirMediaA360dialog({
  archivo,
  apiKey,
}: {
  archivo: File;
  apiKey: string;
}) {
  const formData = new FormData();
  formData.append("messaging_product", "whatsapp");
  formData.append("file", archivo, archivo.name);

  const response = await fetch("https://waba-v2.360dialog.io/media", {
    method: "POST",
    headers: {
      "D360-API-KEY": apiKey,
    },
    body: formData,
  });

  const textoRespuesta = await response.text();
  const data = textoRespuesta ? intentarParsearJson(textoRespuesta) : null;

  if (!response.ok) {
    console.error("Error subiendo media a 360dialog:", {
      status: response.status,
      statusText: response.statusText,
      body: textoRespuesta,
      archivoNombre: archivo.name,
      archivoTipo: archivo.type,
      archivoSize: archivo.size,
    });

    throw new Error(
      `Error subiendo media a 360dialog: ${response.status} ${response.statusText}`
    );
  }

  const mediaId =
    data && typeof data === "object" && "id" in data
      ? String((data as { id: string }).id)
      : null;

  if (!mediaId) {
    console.error("360dialog no devolvió mediaId:", data);
    throw new Error("360dialog no devolvió mediaId");
  }

  return {
    mediaId,
    data,
  };
}

async function extraerBody(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();

    const telefono = String(formData.get("telefono") ?? "").trim();
    const conversacionId = String(formData.get("conversacionId") ?? "").trim();
    const texto = typeof formData.get("texto") === "string"
      ? String(formData.get("texto"))
      : "";

    const tipoRaw = String(formData.get("tipo") ?? "").trim();
    const tipo: TipoMensajeSaliente =
      tipoRaw === "image" || tipoRaw === "video" || tipoRaw === "document"
        ? tipoRaw
        : "text";

    const mediaIdRaw = formData.get("mediaId");
    const mimeTypeRaw = formData.get("mimeType");
    const nombreArchivoRaw = formData.get("nombreArchivo");
    const archivoRaw = formData.get("archivo");

    return {
      telefono,
      conversacionId,
      texto,
      tipo,
      mediaId:
        typeof mediaIdRaw === "string" && mediaIdRaw.trim().length > 0
          ? mediaIdRaw.trim()
          : null,
      mimeType:
        typeof mimeTypeRaw === "string" && mimeTypeRaw.trim().length > 0
          ? mimeTypeRaw.trim()
          : null,
      nombreArchivo:
        typeof nombreArchivoRaw === "string" && nombreArchivoRaw.trim().length > 0
          ? nombreArchivoRaw.trim()
          : null,
      archivo: archivoRaw instanceof File ? archivoRaw : null,
    };
  }

  const body = await req.json();

  return {
    telefono: String(body?.telefono ?? "").trim(),
    conversacionId: String(body?.conversacionId ?? "").trim(),
    texto: typeof body?.texto === "string" ? body.texto : "",
    tipo:
      body?.tipo === "image" ||
      body?.tipo === "video" ||
      body?.tipo === "document"
        ? body.tipo
        : "text",
    mediaId: typeof body?.mediaId === "string" ? body.mediaId : null,
    mimeType: typeof body?.mimeType === "string" ? body.mimeType : null,
    nombreArchivo:
      typeof body?.nombreArchivo === "string" ? body.nombreArchivo : null,
    archivo: null,
  };
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

    const body = await extraerBody(req);

    const telefono = body.telefono;
    const conversacionId = body.conversacionId;
    const texto = body.texto;
    let tipo: TipoMensajeSaliente = body.tipo;
    let mediaId = body.mediaId;
    let mimeType = body.mimeType;
    let nombreArchivo = body.nombreArchivo;
    const archivo = body.archivo;

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
        .select("id, phone_number_id, numero, nombre_interno, activo, api_key")
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

    if (archivo) {
      mimeType = archivo.type || mimeType || "application/octet-stream";
      nombreArchivo = archivo.name || nombreArchivo || "archivo";
      tipo = inferirTipoMensajeDesdeMimeType(mimeType);

      console.log("Archivo recibido en /api/whatsapp/enviar:", {
        nombre: archivo.name,
        tipoMime: archivo.type,
        size: archivo.size,
        conversacionId,
        telefono,
      });

      const subida = await subirMediaA360dialog({
        archivo,
        apiKey,
      });

      mediaId = subida.mediaId;

      console.log("Media subida correctamente a 360dialog:", {
        mediaId,
        nombreArchivo,
        mimeType,
        tipo,
      });
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
          { ok: false, error: "mediaId o archivo es requerido para imagen" },
          { status: 400 }
        );
      }

      payload = {
        messaging_product: "whatsapp",
        to: telefono,
        type: "image",
        image: {
          id: mediaId,
          ...(texto.trim() ? { caption: texto.trim() } : {}),
        },
      };
    } else if (tipo === "video") {
      if (!mediaId) {
        return NextResponse.json(
          { ok: false, error: "mediaId o archivo es requerido para video" },
          { status: 400 }
        );
      }

      payload = {
        messaging_product: "whatsapp",
        to: telefono,
        type: "video",
        video: {
          id: mediaId,
          ...(texto.trim() ? { caption: texto.trim() } : {}),
        },
      };
    } else {
      if (!mediaId) {
        return NextResponse.json(
          { ok: false, error: "mediaId o archivo es requerido para documento" },
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
          ...(texto.trim() ? { caption: texto.trim() } : {}),
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
        payload,
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
        ? (data as { messages?: Array<{ id?: string }> }).messages?.[0]?.id ?? null
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
      mediaId,
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