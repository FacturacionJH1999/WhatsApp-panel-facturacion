import { NextResponse } from "next/server";
import { guardarMensajeSaliente } from "@/lib/whatsapp/guardarMensajeSaliente";

const API_KEY = process.env.D360_API_KEY;

type TipoMensajeSaliente = "text" | "image" | "video" | "document";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const telefono = String(body?.telefono ?? "").trim();
    const texto = typeof body?.texto === "string" ? body.texto : "";
    const tipo: TipoMensajeSaliente =
      body?.tipo === "image" ||
      body?.tipo === "video" ||
      body?.tipo === "document"
        ? body.tipo
        : "text";

    const mediaId =
      typeof body?.mediaId === "string" ? body.mediaId : null;

    const mimeType =
      typeof body?.mimeType === "string" ? body.mimeType : null;

    const nombreArchivo =
      typeof body?.nombreArchivo === "string" ? body.nombreArchivo : null;

    if (!telefono) {
      return NextResponse.json(
        { error: "telefono es requerido" },
        { status: 400 }
      );
    }

    if (!API_KEY) {
      return NextResponse.json(
        { error: "Falta D360_API_KEY" },
        { status: 500 }
      );
    }

    let payload: Record<string, unknown>;

    if (tipo === "text") {
      if (!texto.trim()) {
        return NextResponse.json(
          { error: "texto es requerido" },
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
          { error: "mediaId es requerido para imagen" },
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
          { error: "mediaId es requerido para video" },
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
          { error: "mediaId es requerido para documento" },
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
        "D360-API-KEY": API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Error enviando mensaje",
          detalle: data,
        },
        { status: response.status }
      );
    }

    const waMessageId = data?.messages?.[0]?.id ?? null;
    const fechaMensaje = new Date().toISOString();

    await guardarMensajeSaliente({
      telefono,
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

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("Error enviando mensaje:", error);

    return NextResponse.json(
      { error: "Error enviando mensaje" },
      { status: 500 }
    );
  }
}