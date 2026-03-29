import { supabaseAdmin } from "../supabaseAdmin";
import { obtenerConfiguracionNumeroWhatsapp } from "./obtenerConfiguracionNumeroWhatsapp";

type DescargarYGuardarMediaParams = {
  mediaId: string;
  mimeType: string | null;
  mensajeId: string;
  mediaUrl?: string | null;
  numeroWhatsappId?: string | null;
  phoneNumberId?: string | null;
};

function normalizarUrlDescarga(url: string) {
  return url.replace(
    "https://lookaside.fbsbx.com",
    "https://waba-v2.360dialog.io"
  );
}

function obtenerExtensionDesdeMimeType(mimeType: string | null) {
  if (!mimeType) return "bin";

  const mapaExtensiones: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "application/pdf": "pdf",
  };

  return mapaExtensiones[mimeType] ?? mimeType.split("/")[1] ?? "bin";
}

async function marcarMediaComoError(mensajeId: string) {
  const { error } = await supabaseAdmin
    .from("mensajes")
    .update({
      estado_media: "error",
    })
    .eq("id", mensajeId);

  if (error) {
    console.error("Error marcando media como error:", error);
  }
}

export async function descargarYGuardarMedia({
  mediaId,
  mimeType,
  mensajeId,
  mediaUrl,
  numeroWhatsappId,
  phoneNumberId,
}: DescargarYGuardarMediaParams) {
  try {
    const configNumero = await obtenerConfiguracionNumeroWhatsapp({
      numeroWhatsappId,
      phoneNumberId,
    });

    const apiKey = configNumero.apiKey;

    console.log("D360 API key cargada para descarga", {
      numeroWhatsappId: configNumero.id,
      displayPhoneNumber: configNumero.displayPhoneNumber,
      phoneNumberId: configNumero.phoneNumberId,
      existe: Boolean(apiKey),
      longitud: apiKey.length,
      contieneSaltos: /\r|\n/.test(apiKey),
      inicio: apiKey.slice(0, 6),
      fin: apiKey.slice(-6),
    });

    let downloadUrl: string | null = mediaUrl?.trim() || null;

    if (!downloadUrl) {
      const infoResponse = await fetch(`https://waba-v2.360dialog.io/${mediaId}`, {
        headers: {
          "D360-API-KEY": apiKey,
        },
      });

      if (!infoResponse.ok) {
        const bodyError = await infoResponse.text().catch(() => "");
        console.error(
          "Error obteniendo media info:",
          infoResponse.status,
          bodyError
        );
        await marcarMediaComoError(mensajeId);
        return;
      }

      const info = await infoResponse.json();

      if (!info?.url) {
        console.error("Media sin URL");
        await marcarMediaComoError(mensajeId);
        return;
      }

      downloadUrl = info.url;
    }

    if (!downloadUrl) {
      console.error("No se pudo resolver downloadUrl para la media");
      await marcarMediaComoError(mensajeId);
      return;
    }

    downloadUrl = normalizarUrlDescarga(downloadUrl);

    console.log("Descargando media:", {
      mensajeId,
      mediaId,
      downloadUrl,
      usoUrlDirectaWebhook: Boolean(mediaUrl),
      numeroWhatsappId: configNumero.id,
      displayPhoneNumber: configNumero.displayPhoneNumber,
    });

    const mediaResponse = await fetch(downloadUrl, {
      headers: {
        "D360-API-KEY": apiKey,
      },
    });

    if (!mediaResponse.ok) {
      const bodyError = await mediaResponse.text().catch(() => "");
      console.error("Error descargando media:", mediaResponse.status, bodyError);
      await marcarMediaComoError(mensajeId);
      return;
    }

    const buffer = await mediaResponse.arrayBuffer();
    const fileBuffer = Buffer.from(buffer);

    const extension = obtenerExtensionDesdeMimeType(mimeType);
    const storagePath = `whatsapp/${mensajeId}.${extension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("whatsapp-media")
      .upload(storagePath, fileBuffer, {
        contentType: mimeType ?? "application/octet-stream",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error subiendo a storage:", uploadError);
      await marcarMediaComoError(mensajeId);
      return;
    }

    const { data } = supabaseAdmin.storage
      .from("whatsapp-media")
      .getPublicUrl(storagePath);

    const { error: errorActualizarMensaje } = await supabaseAdmin
      .from("mensajes")
      .update({
        storage_bucket: "whatsapp-media",
        storage_path: storagePath,
        url_archivo: data.publicUrl,
        tamano_bytes: fileBuffer.length,
        estado_media: "guardado",
      })
      .eq("id", mensajeId);

    if (errorActualizarMensaje) {
      console.error(
        "Error actualizando mensaje con media:",
        errorActualizarMensaje
      );
      return;
    }

    console.log("Media guardada correctamente:", {
      mensajeId,
      mediaId,
      storagePath,
      usoUrlDirectaWebhook: Boolean(mediaUrl),
      numeroWhatsappId: configNumero.id,
      displayPhoneNumber: configNumero.displayPhoneNumber,
    });
  } catch (error) {
    console.error("Error guardando media:", error);
    await marcarMediaComoError(mensajeId);
  }
}