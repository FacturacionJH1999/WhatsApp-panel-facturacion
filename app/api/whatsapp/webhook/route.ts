import { NextResponse } from "next/server";
import { guardarMensajeEntrante } from "@/lib/whatsapp/guardarMensajeEntrante";

export async function GET() {
  return NextResponse.json({ ok: true, mensaje: "Webhook activo" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("Webhook recibido:", JSON.stringify(body, null, 2));

    const mensajes = body?.messages;

    if (Array.isArray(mensajes) && mensajes.length > 0) {
      for (const mensaje of mensajes) {
        const telefono = mensaje?.from;
        const waMessageId = mensaje?.id ?? null;
        const tipo = mensaje?.type ?? "desconocido";
        const fechaMensaje = mensaje?.timestamp
          ? new Date(Number(mensaje.timestamp) * 1000).toISOString()
          : new Date().toISOString();

        if (!telefono) {
          continue;
        }

        let texto: string | null = null;
        let nombreArchivo: string | null = null;
        let mimeType: string | null = null;
        let mediaId: string | null = null;

        if (tipo === "text") {
          texto = mensaje?.text?.body ?? null;
        }

        if (tipo === "image") {
          mimeType = mensaje?.image?.mime_type ?? null;
          mediaId = mensaje?.image?.id ?? null;
        }

        if (tipo === "document") {
          nombreArchivo = mensaje?.document?.filename ?? null;
          mimeType = mensaje?.document?.mime_type ?? null;
          mediaId = mensaje?.document?.id ?? null;
        }

        if (tipo === "video") {
          mimeType = mensaje?.video?.mime_type ?? null;
          mediaId = mensaje?.video?.id ?? null;
        }

        if (tipo === "audio") {
          mimeType = mensaje?.audio?.mime_type ?? null;
          mediaId = mensaje?.audio?.id ?? null;
        }

        await guardarMensajeEntrante({
          telefono,
          nombre: null,
          waMessageId,
          tipo,
          texto,
          nombreArchivo,
          mimeType,
          mediaId,
          fechaMensaje,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error en webhook:", error);
    return NextResponse.json(
      { ok: false, error: "Error procesando webhook" },
      { status: 500 }
    );
  }
}