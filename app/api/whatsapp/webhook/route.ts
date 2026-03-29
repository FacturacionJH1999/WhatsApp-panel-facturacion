import { NextResponse } from "next/server";
import { guardarMensajeEntrante } from "@/lib/whatsapp/guardarMensajeEntrante";
import { reenviarArchivoAlPapa } from "@/lib/whatsapp/reenviarArchivoAlPapa";

function convertirFechaMensaje(timestamp: unknown): string {
  if (typeof timestamp === "string" || typeof timestamp === "number") {
    const numero = Number(timestamp);

    if (Number.isFinite(numero) && numero > 0) {
      return new Date(numero * 1000).toISOString();
    }

    const fechaDirecta = new Date(timestamp);
    if (!Number.isNaN(fechaDirecta.getTime())) {
      return fechaDirecta.toISOString();
    }
  }

  return new Date().toISOString();
}

export async function GET() {
  return NextResponse.json({ ok: true, mensaje: "Webhook activo" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("Webhook recibido completo:", JSON.stringify(body, null, 2));

    const entries = Array.isArray(body?.entry) ? body.entry : [];

    if (entries.length === 0) {
      const mensajesDirectos = Array.isArray(body?.messages) ? body.messages : [];
      const contactosDirectos = Array.isArray(body?.contacts) ? body.contacts : [];

      if (mensajesDirectos.length === 0) {
        return NextResponse.json({
          ok: true,
          mensaje: "Sin entries ni mensajes para procesar",
        });
      }

      await procesarMensajes({
        mensajes: mensajesDirectos,
        contactos: contactosDirectos,
        metadata: body?.metadata ?? null,
      });

      return NextResponse.json({ ok: true });
    }

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];

      for (const change of changes) {
        const value = change?.value ?? {};
        const mensajes = Array.isArray(value?.messages) ? value.messages : [];
        const contactos = Array.isArray(value?.contacts) ? value.contacts : [];
        const metadata = value?.metadata ?? null;

        console.log("Change detectado:", JSON.stringify(change, null, 2));
        console.log(
          "Mensajes extraídos de change:",
          JSON.stringify(mensajes, null, 2)
        );
        console.log("Metadata detectada:", JSON.stringify(metadata, null, 2));

        if (mensajes.length === 0) {
          continue;
        }

        await procesarMensajes({
          mensajes,
          contactos,
          metadata,
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

type ProcesarMensajesParams = {
  mensajes: any[];
  contactos: any[];
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  } | null;
};

async function procesarMensajes({
  mensajes,
  contactos,
  metadata,
}: ProcesarMensajesParams) {
  const phoneNumberId =
    typeof metadata?.phone_number_id === "string"
      ? metadata.phone_number_id
      : null;

  const numeroDestino =
    typeof metadata?.display_phone_number === "string"
      ? metadata.display_phone_number
      : null;

  for (const mensaje of mensajes) {
    try {
      const telefono = mensaje?.from ?? null;
      const waMessageId = mensaje?.id ?? null;
      const tipo =
        typeof mensaje?.type === "string" ? mensaje.type : "desconocido";
      const fechaMensaje = convertirFechaMensaje(mensaje?.timestamp);

      if (!telefono) {
        console.warn("Mensaje ignorado por no traer teléfono:", mensaje);
        continue;
      }

      if (!phoneNumberId) {
        console.warn(
          "Mensaje ignorado porque no llegó phone_number_id en metadata:",
          {
            mensaje,
            metadata,
          }
        );
        continue;
      }

      const contacto = Array.isArray(contactos)
        ? contactos.find(
            (item: { wa_id?: string; profile?: { name?: string } }) =>
              item?.wa_id === telefono
          )
        : null;

      const nombre = contacto?.profile?.name ?? null;

      let texto: string | null = null;
      let nombreArchivo: string | null = null;
      let mimeType: string | null = null;
      let mediaId: string | null = null;
      let mediaUrl: string | null = null;

      if (tipo === "text") {
        texto =
          typeof mensaje?.text?.body === "string" ? mensaje.text.body : null;
      }

      if (tipo === "image") {
        mimeType =
          typeof mensaje?.image?.mime_type === "string"
            ? mensaje.image.mime_type
            : null;

        mediaId =
          typeof mensaje?.image?.id === "string" ? mensaje.image.id : null;

        mediaUrl =
          typeof mensaje?.image?.url === "string" ? mensaje.image.url : null;

        if (
          typeof mensaje?.image?.caption === "string" &&
          mensaje.image.caption.trim()
        ) {
          texto = mensaje.image.caption.trim();
        }
      }

      if (tipo === "document") {
        nombreArchivo =
          typeof mensaje?.document?.filename === "string"
            ? mensaje.document.filename
            : null;

        mimeType =
          typeof mensaje?.document?.mime_type === "string"
            ? mensaje.document.mime_type
            : null;

        mediaId =
          typeof mensaje?.document?.id === "string"
            ? mensaje.document.id
            : null;

        mediaUrl =
          typeof mensaje?.document?.url === "string"
            ? mensaje.document.url
            : null;
      }

      if (tipo === "video") {
        mimeType =
          typeof mensaje?.video?.mime_type === "string"
            ? mensaje.video.mime_type
            : null;

        mediaId =
          typeof mensaje?.video?.id === "string" ? mensaje.video.id : null;

        mediaUrl =
          typeof mensaje?.video?.url === "string" ? mensaje.video.url : null;

        if (
          typeof mensaje?.video?.caption === "string" &&
          mensaje.video.caption.trim()
        ) {
          texto = mensaje.video.caption.trim();
        }
      }

      if (tipo === "audio") {
        mimeType =
          typeof mensaje?.audio?.mime_type === "string"
            ? mensaje.audio.mime_type
            : null;

        mediaId =
          typeof mensaje?.audio?.id === "string" ? mensaje.audio.id : null;

        mediaUrl =
          typeof mensaje?.audio?.url === "string" ? mensaje.audio.url : null;
      }

      console.log("Procesando mensaje individual:", {
        telefono,
        nombre,
        waMessageId,
        tipo,
        texto,
        nombreArchivo,
        mimeType,
        mediaId,
        mediaUrl,
        fechaMensaje,
        phoneNumberId,
        numeroDestino,
      });

      const resultado = await guardarMensajeEntrante({
        telefono,
        nombre,
        waMessageId,
        tipo,
        texto,
        nombreArchivo,
        mimeType,
        mediaId,
        mediaUrl,
        fechaMensaje,
        phoneNumberId,
        numeroDestino,
      });

      if (resultado?.duplicado) {
        console.log("Se omite procesamiento adicional por duplicado:", {
          waMessageId,
          tipo,
        });
        continue;
      }

      const numeroWhatsappId = resultado?.numeroWhatsappId ?? null;

      const esImagen = tipo === "image";
      const esDocumento = tipo === "document";

      const esPdf = mimeType === "application/pdf";
      const esWordAntiguo = mimeType === "application/msword";
      const esWordNuevo =
        mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      if (mediaId && esImagen) {
        await reenviarArchivoAlPapa({
          mediaId,
          tipo: "image",
          telefonoCliente: telefono,
          numeroWhatsappId,
          phoneNumberId,
        });
      }

      if (mediaId && esDocumento && (esPdf || esWordAntiguo || esWordNuevo)) {
        await reenviarArchivoAlPapa({
          mediaId,
          tipo: "document",
          nombreArchivo,
          telefonoCliente: telefono,
          numeroWhatsappId,
          phoneNumberId,
        });
      }
    } catch (errorPorMensaje) {
      console.error("Error procesando mensaje individual:", errorPorMensaje, {
        mensaje,
      });
    }
  }
}