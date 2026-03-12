import { supabaseAdmin } from "../supabaseAdmin";

type ActualizarArchivoMensajeParams = {
  waMessageId: string;
  storagePath: string;
  tamanoBytes: number;
};

export async function actualizarArchivoMensaje({
  waMessageId,
  storagePath,
  tamanoBytes,
}: ActualizarArchivoMensajeParams) {
  const { error } = await supabaseAdmin
    .from("mensajes")
    .update({
      storage_path: storagePath,
      tamano_bytes: tamanoBytes,
      url_archivo: storagePath,
    })
    .eq("wa_message_id", waMessageId);

  if (error) {
    throw error;
  }
}