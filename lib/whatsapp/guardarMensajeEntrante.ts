import { supabaseAdmin } from "../supabaseAdmin";

type GuardarMensajeEntranteParams = {
  telefono: string;
  nombre?: string | null;
  waMessageId?: string | null;
  tipo: string;
  texto?: string | null;
  nombreArchivo?: string | null;
  mimeType?: string | null;
  mediaId?: string | null;
  fechaMensaje?: string | null;
};

export async function guardarMensajeEntrante({
  telefono,
  nombre,
  waMessageId,
  tipo,
  texto,
  nombreArchivo,
  mimeType,
  mediaId,
  fechaMensaje,
}: GuardarMensajeEntranteParams) {
  let contactoId = "";
  let conversacionId = "";

  const { data: contactoExistente, error: errorContactoBusqueda } = await supabaseAdmin
    .from("contactos")
    .select("id")
    .eq("telefono", telefono)
    .maybeSingle();

  if (errorContactoBusqueda) {
    throw errorContactoBusqueda;
  }

  if (contactoExistente?.id) {
    contactoId = contactoExistente.id;
  } else {
    const { data: nuevoContacto, error: errorNuevoContacto } = await supabaseAdmin
      .from("contactos")
      .insert({
        telefono,
        nombre: nombre ?? null,
      })
      .select("id")
      .single();

    if (errorNuevoContacto) {
      throw errorNuevoContacto;
    }

    if (!nuevoContacto?.id) {
      throw new Error("No se pudo crear el contacto");
    }

    contactoId = nuevoContacto.id;
  }

  const { data: conversacionExistente, error: errorConversacionBusqueda } = await supabaseAdmin
    .from("conversaciones")
    .select("id")
    .eq("contacto_id", contactoId)
    .maybeSingle();

  if (errorConversacionBusqueda) {
    throw errorConversacionBusqueda;
  }

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

    if (errorNuevaConversacion) {
      throw errorNuevaConversacion;
    }

    if (!nuevaConversacion?.id) {
      throw new Error("No se pudo crear la conversación");
    }

    conversacionId = nuevaConversacion.id;
  }

  const { error: errorMensaje } = await supabaseAdmin.from("mensajes").insert({
    conversacion_id: conversacionId,
    wa_message_id: waMessageId ?? null,
    direccion: "entrante",
    tipo,
    texto: texto ?? null,
    nombre_archivo: nombreArchivo ?? null,
    mime_type: mimeType ?? null,
    media_id: mediaId ?? null,
    fecha_mensaje: fechaMensaje ?? new Date().toISOString(),
  });

  if (errorMensaje) {
    throw errorMensaje;
  }

  const { error: errorActualizarConversacion } = await supabaseAdmin
    .from("conversaciones")
    .update({
      ultima_actividad: fechaMensaje ?? new Date().toISOString(),
    })
    .eq("id", conversacionId);

  if (errorActualizarConversacion) {
    throw errorActualizarConversacion;
  }
}