import { supabaseAdmin } from "../supabaseAdmin";

type GuardarMensajeSalienteParams = {
  telefono: string;
  conversacionId: string;
  numeroWhatsappId: string;
  texto?: string | null;
  waMessageId?: string | null;
  fechaMensaje?: string | null;
  tipo: "text" | "image" | "video" | "document";
  mimeType?: string | null;
  nombreArchivo?: string | null;
  mediaId?: string | null;
};

function normalizarTexto(texto: string | null | undefined) {
  if (typeof texto !== "string") return null;
  const limpio = texto.trim();
  return limpio.length > 0 ? limpio : null;
}

// 🔥 CORREGIDO: ya no marca "pendiente" para salientes
function calcularEstadoMedia() {
  return "no_aplica";
}

export async function guardarMensajeSaliente({
  telefono,
  conversacionId,
  numeroWhatsappId,
  texto,
  waMessageId,
  fechaMensaje,
  tipo,
  mimeType,
  nombreArchivo,
  mediaId,
}: GuardarMensajeSalienteParams) {
  const fechaFinal = fechaMensaje ?? new Date().toISOString();
  const textoNormalizado = normalizarTexto(texto);
  const estadoMedia = calcularEstadoMedia();

  console.log("guardarMensajeSaliente() inicio:", {
    telefono,
    conversacionId,
    numeroWhatsappId,
    textoOriginal: texto ?? null,
    textoNormalizado,
    waMessageId: waMessageId ?? null,
    fechaFinal,
    tipo,
    mimeType: mimeType ?? null,
    nombreArchivo: nombreArchivo ?? null,
    mediaId: mediaId ?? null,
    estadoMedia,
  });

  const { data: conversacion, error: errorConversacion } = await supabaseAdmin
    .from("conversaciones")
    .select("id, contacto_id, numero_whatsapp_id")
    .eq("id", conversacionId)
    .maybeSingle();

  if (errorConversacion) {
    console.error("Error buscando conversación:", errorConversacion);
    throw errorConversacion;
  }

  if (!conversacion?.id) {
    throw new Error("La conversación indicada no existe");
  }

  if (conversacion.numero_whatsapp_id !== numeroWhatsappId) {
    throw new Error(
      "La conversación no coincide con el numero_whatsapp_id enviado"
    );
  }

  const payloadMensaje = {
    conversacion_id: conversacionId,
    numero_whatsapp_id: numeroWhatsappId,
    wa_message_id: waMessageId ?? null,
    direccion: "saliente" as const,
    tipo,
    texto: textoNormalizado,
    nombre_archivo: nombreArchivo ?? null,
    mime_type: mimeType ?? null,
    media_id: mediaId ?? null,
    fecha_mensaje: fechaFinal,
    estado_media: estadoMedia,
  };

  console.log("Insertando mensaje saliente en Supabase:", payloadMensaje);

  const { data: nuevoMensaje, error: errorNuevoMensaje } = await supabaseAdmin
    .from("mensajes")
    .insert(payloadMensaje)
    .select("id")
    .single();

  if (errorNuevoMensaje) {
    console.error("Error guardando mensaje saliente:", errorNuevoMensaje);
    throw errorNuevoMensaje;
  }

  const { error: errorActualizarConversacion } = await supabaseAdmin
    .from("conversaciones")
    .update({
      ultima_actividad: fechaFinal,
    })
    .eq("id", conversacionId);

  if (errorActualizarConversacion) {
    console.error(
      "Error actualizando ultima_actividad de conversación:",
      errorActualizarConversacion
    );
    throw errorActualizarConversacion;
  }

  console.log("guardarMensajeSaliente() completado:", {
    mensajeId: nuevoMensaje?.id ?? null,
    conversacionId,
    numeroWhatsappId,
  });

  return {
    ok: true,
    mensajeId: nuevoMensaje?.id ?? null,
    conversacionId,
  };
}