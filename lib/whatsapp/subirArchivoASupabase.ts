import { supabaseAdmin } from "../supabaseAdmin";

type SubirArchivoParams = {
  buffer: Buffer;
  nombreArchivo: string;
  mimeType?: string | null;
};

function limpiarNombreArchivo(nombreArchivo: string) {
  return nombreArchivo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();
}

export async function subirArchivoASupabase({
  buffer,
  nombreArchivo,
  mimeType,
}: SubirArchivoParams) {
  const fecha = new Date();
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");

  const nombreLimpio = limpiarNombreArchivo(nombreArchivo || "archivo");
  const nombreFinal = `${Date.now()}-${nombreLimpio}`;
  const storagePath = `${año}/${mes}/${dia}/${nombreFinal}`;

  const { error } = await supabaseAdmin.storage
    .from("archivos-whatsapp")
    .upload(storagePath, buffer, {
      contentType: mimeType ?? "application/octet-stream",
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return {
    storagePath,
    tamanoBytes: buffer.length,
  };
}