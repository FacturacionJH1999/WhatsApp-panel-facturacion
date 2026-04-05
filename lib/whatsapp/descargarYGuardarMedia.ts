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

async function esperar(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function extraerMensajeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return String(error);
}

function esErrorTransitorioStorage(error: unknown) {
  const mensaje = extraerMensajeError(error).toLowerCase();

  if (
    mensaje.includes("timed out") ||
    mensaje.includes("timeout") ||
    mensaje.includes("connection") ||
    mensaje.includes("network") ||
    mensaje.includes("tempor")
  ) {
    return true;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
  ) {
    const status = (error as { status: number }).status;
    return status >= 500;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as { statusCode: unknown }).statusCode === "string"
  ) {
    const statusCode = Number((error as { statusCode: string }).statusCode);
    if (!Number.isNaN(statusCode) && statusCode >= 500) {
      return true;
    }
  }

  return false;
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

async function subirArchivoAStorageConReintentos(params: {
  bucket: string;
  storagePath: string;
  fileBuffer: Buffer;
  contentType: string;
  mensajeId: string;
  mediaId: string;
  numeroWhatsappId: string;
  numero: string | null;
  intentosMaximos?: number;
}) {
  const {
    bucket,
    storagePath,
    fileBuffer,
    contentType,
    mensajeId,
    mediaId,
    numeroWhatsappId,
    numero,
    intentosMaximos = 3,
  } = params;

  let ultimoError: unknown = null;

  for (let intento = 1; intento <= intentosMaximos; intento++) {
    try {
      console.log("Subiendo media a storage:", {
        intento,
        intentosMaximos,
        mensajeId,
        mediaId,
        storagePath,
        bucket,
        numeroWhatsappId,
        numero,
        tamanoBytes: fileBuffer.length,
        contentType,
      });

      const { error: uploadError } = await supabaseAdmin.storage
        .from(bucket)
        .upload(storagePath, fileBuffer, {
          contentType,
          upsert: true,
        });

      if (!uploadError) {
        console.log("Media subida a storage correctamente:", {
          intento,
          mensajeId,
          mediaId,
          storagePath,
          bucket,
          numeroWhatsappId,
          numero,
        });
        return;
      }

      ultimoError = uploadError;

      console.error("Error subiendo a storage:", {
        intento,
        intentosMaximos,
        mensajeId,
        mediaId,
        storagePath,
        bucket,
        numeroWhatsappId,
        numero,
        error: uploadError,
      });

      const debeReintentar =
        intento < intentosMaximos && esErrorTransitorioStorage(uploadError);

      if (!debeReintentar) {
        throw uploadError;
      }

      const esperaMs = intento * 1000;

      console.warn("Reintentando subida a storage tras error transitorio:", {
        intentoActual: intento,
        siguienteIntento: intento + 1,
        esperaMs,
        mensajeId,
        mediaId,
        storagePath,
      });

      await esperar(esperaMs);
    } catch (error) {
      ultimoError = error;

      console.error("Excepción durante subida a storage:", {
        intento,
        intentosMaximos,
        mensajeId,
        mediaId,
        storagePath,
        bucket,
        numeroWhatsappId,
        numero,
        error,
      });

      const debeReintentar =
        intento < intentosMaximos && esErrorTransitorioStorage(error);

      if (!debeReintentar) {
        throw error;
      }

      const esperaMs = intento * 1000;

      console.warn("Reintentando subida a storage por excepción transitoria:", {
        intentoActual: intento,
        siguienteIntento: intento + 1,
        esperaMs,
        mensajeId,
        mediaId,
        storagePath,
      });

      await esperar(esperaMs);
    }
  }

  throw ultimoError ?? new Error("No se pudo subir el archivo a storage");
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
      numero: configNumero.numero,
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
        console.error("Error obteniendo media info:", {
          mensajeId,
          mediaId,
          status: infoResponse.status,
          bodyError,
          numeroWhatsappId: configNumero.id,
          numero: configNumero.numero,
        });
        await marcarMediaComoError(mensajeId);
        return;
      }

      const info = await infoResponse.json();

      if (!info?.url) {
        console.error("Media sin URL", {
          mensajeId,
          mediaId,
          numeroWhatsappId: configNumero.id,
          numero: configNumero.numero,
        });
        await marcarMediaComoError(mensajeId);
        return;
      }

      downloadUrl = info.url;
    }

    if (!downloadUrl) {
      console.error("No se pudo resolver downloadUrl para la media", {
        mensajeId,
        mediaId,
        numeroWhatsappId: configNumero.id,
        numero: configNumero.numero,
      });
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
      numero: configNumero.numero,
    });

    const mediaResponse = await fetch(downloadUrl, {
      headers: {
        "D360-API-KEY": apiKey,
      },
    });

    if (!mediaResponse.ok) {
      const bodyError = await mediaResponse.text().catch(() => "");
      console.error("Error descargando media:", {
        mensajeId,
        mediaId,
        status: mediaResponse.status,
        bodyError,
        numeroWhatsappId: configNumero.id,
        numero: configNumero.numero,
      });
      await marcarMediaComoError(mensajeId);
      return;
    }

    const buffer = await mediaResponse.arrayBuffer();
    const fileBuffer = Buffer.from(buffer);

    const extension = obtenerExtensionDesdeMimeType(mimeType);
    const storagePath = `whatsapp/${mensajeId}.${extension}`;
    const contentType = mimeType ?? "application/octet-stream";

    await subirArchivoAStorageConReintentos({
      bucket: "whatsapp-media",
      storagePath,
      fileBuffer,
      contentType,
      mensajeId,
      mediaId,
      numeroWhatsappId: configNumero.id,
      numero: configNumero.numero,
      intentosMaximos: 3,
    });

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
      console.error("Error actualizando mensaje con media:", {
        mensajeId,
        mediaId,
        storagePath,
        numeroWhatsappId: configNumero.id,
        numero: configNumero.numero,
        error: errorActualizarMensaje,
      });
      return;
    }

    console.log("Media guardada correctamente:", {
      mensajeId,
      mediaId,
      storagePath,
      usoUrlDirectaWebhook: Boolean(mediaUrl),
      numeroWhatsappId: configNumero.id,
      numero: configNumero.numero,
    });
  } catch (error) {
    console.error("Error guardando media:", {
      mensajeId,
      mediaId,
      numeroWhatsappId,
      phoneNumberId,
      error,
    });
    await marcarMediaComoError(mensajeId);
  }
}