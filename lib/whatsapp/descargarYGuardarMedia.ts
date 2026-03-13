import { supabaseAdmin } from "../supabaseAdmin";

export async function descargarYGuardarMedia({
  mediaId,
  mimeType,
  mensajeId,
}: {
  mediaId: string;
  mimeType: string | null;
  mensajeId: string;
}) {
  try {
    const apiKey = process.env.D360_API_KEY;

    if (!apiKey) {
      console.error("Falta D360_API_KEY");
      return;
    }

    // 1️⃣ obtener url temporal del media
    const infoResponse = await fetch(
      `https://waba-v2.360dialog.io/${mediaId}`,
      {
        headers: {
          "D360-API-KEY": apiKey,
        },
      }
    );

    if (!infoResponse.ok) {
      console.error("Error obteniendo media info");
      return;
    }

    const info = await infoResponse.json();

    if (!info?.url) {
      console.error("Media sin URL");
      return;
    }

    const downloadUrl = info.url.replace(
      "https://lookaside.fbsbx.com",
      "https://waba-v2.360dialog.io"
    );

    // 2️⃣ descargar archivo
    const mediaResponse = await fetch(downloadUrl, {
      headers: {
        "D360-API-KEY": apiKey,
      },
    });

    if (!mediaResponse.ok) {
      console.error("Error descargando media");
      return;
    }

    const buffer = await mediaResponse.arrayBuffer();
    const fileBuffer = Buffer.from(buffer);

    const extension = mimeType?.split("/")[1] ?? "bin";

    const storagePath = `whatsapp/${mensajeId}.${extension}`;

    // 3️⃣ subir a Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from("whatsapp-media")
      .upload(storagePath, fileBuffer, {
        contentType: mimeType ?? "application/octet-stream",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error subiendo a storage:", uploadError);
      return;
    }

    // 4️⃣ obtener url pública
    const { data } = supabaseAdmin.storage
      .from("whatsapp-media")
      .getPublicUrl(storagePath);

    // 5️⃣ actualizar mensaje
    await supabaseAdmin
      .from("mensajes")
      .update({
        storage_bucket: "whatsapp-media",
        storage_path: storagePath,
        url_archivo: data.publicUrl,
        tamano_bytes: fileBuffer.length,
        estado_media: "guardado",
      })
      .eq("id", mensajeId);

    console.log("Media guardado:", storagePath);
  } catch (error) {
    console.error("Error guardando media:", error);
  }
}