import { supabaseAdmin } from "../supabaseAdmin";

type GuardarMensajeSalienteParams = {
  telefono: string;
  texto: string;
  waMessageId?: string | null;
  fechaMensaje?: string | null;
  tipo?: string;
  mimeType?: string | null;
  nombreArchivo?: string | null;
  mediaId?: string | null;
};

export async function guardarMensajeSaliente({
  telefono,
  texto,
  waMessageId,
  fechaMensaje,
  tipo = "text",
  mimeType = null,
  nombreArchivo = null,
  mediaId = null,
}: GuardarMensajeSalienteParams) {
  let contactoId = "";
  let conversacionId = "";

  const fechaFinal = fechaMensaje ?? new Date().toISOString();

  const { data: contactoExistente, error: errorContactoBusqueda } = await supabaseAdmin
    .from("contactos")
    .select("id")
    .eq("telefono", telefono)
    .maybeSingle();

  if (errorContactoBusqueda) throw errorContactoBusqueda;

  if (contactoExistente?.id) {
    contactoId = contactoExistente.id;
  } else {
    const { data: nuevoContacto, error: errorNuevoContacto } = await supabaseAdmin
      .from("contactos")
      .insert({
        telefono,
        nombre: null,
      })
      .select("id")
      .single();

    if (errorNuevoContacto) throw errorNuevoContacto;
    if (!nuevoContacto?.id) throw new Error("No se pudo crear el contacto");

    contactoId = nuevoContacto.id;
  }

  const { data: conversacionExistente, error: errorConversacionBusqueda } = await supabaseAdmin
    .from("conversaciones")
    .select("id")
    .eq("contacto_id", contactoId)
    .maybeSingle();

  if (errorConversacionBusqueda) throw errorConversacionBusqueda;

  if (conversacionExistente?.id) {
    conversacionId = conversacionExistente.id;
  } else {
    const { data: nuevaConversacion, error: errorNuevaConversacion } = await supabaseAdmin
      .from("conversaciones")
      .insert({
        contacto_id: contactoId,
      })
      .select("id")
      .single();

    if (errorNuevaConversacion) throw errorNuevaConversacion;
    if (!nuevaConversacion?.id) throw new Error("No se pudo crear la conversación");

    conversacionId = nuevaConversacion.id;
  }

  if (waMessageId) {
    const { data: mensajeExistente, error: errorMensajeExistente } = await supabaseAdmin
      .from("mensajes")
      .select("id")
      .eq("wa_message_id", waMessageId)
      .maybeSingle();

    if (errorMensajeExistente) throw errorMensajeExistente;
    if (mensajeExistente?.id) return;
  }

  const { error: errorMensaje } = await supabaseAdmin.from("mensajes").insert({
    conversacion_id: conversacionId,
    wa_message_id: waMessageId ?? null,
    direccion: "saliente",
    tipo,
    texto,
    nombre_archivo: nombreArchivo,
    mime_type: mimeType,
    media_id: mediaId,
    fecha_mensaje: fechaFinal,
  });

  if (errorMensaje) throw errorMensaje;

  const { error: errorActualizarConversacion } = await supabaseAdmin
    .from("conversaciones")
    .update({
      ultima_actividad: fechaFinal,
    })
    .eq("id", conversacionId);

  if (errorActualizarConversacion) throw errorActualizarConversacion;
}