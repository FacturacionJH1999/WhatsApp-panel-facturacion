import { supabaseAdmin } from "../supabaseAdmin";
import { descargarYGuardarMedia } from "./descargarYGuardarMedia";

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

type GuardarMensajeEntranteResultado = {
  duplicado: boolean;
  mensajeId: string | null;
  conversacionId: string | null;
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
}: GuardarMensajeEntranteParams): Promise<GuardarMensajeEntranteResultado> {
  let contactoId = "";
  let conversacionId = "";

  const fechaFinal = fechaMensaje ?? new Date().toISOString();

  // 1) ✅ Proteccion contra duplicados por wa_message_id
  if (waMessageId) {
    const { data: mensajeExistente, error: errorMensajeExistente } = await supabaseAdmin
      .from("mensajes")
      .select("id, conversacion_id")
      .eq("wa_message_id", waMessageId)
      .maybeSingle();

    if (errorMensajeExistente) {
      throw errorMensajeExistente;
    }

    if (mensajeExistente?.id) {
      console.log("Mensaje duplicado detectado, se omite:", {
        waMessageId,
        mensajeId: mensajeExistente.id,
      });

      return {
        duplicado: true,
        mensajeId: mensajeExistente.id,
        conversacionId: mensajeExistente.conversacion_id ?? null,
      };
    }
  }

  // 2) Buscar o crear contacto
  const { data: contactoExistente, error: errorContactoBusqueda } = await supabaseAdmin
    .from("contactos")
    .select("id, nombre")
    .eq("telefono", telefono)
    .maybeSingle();

  if (errorContactoBusqueda) {
    throw errorContactoBusqueda;
  }

  if (contactoExistente?.id) {
    contactoId = contactoExistente.id;

    // ✅ Si llegó nombre y el contacto no lo tiene, lo actualizamos
    if (nombre && !contactoExistente.nombre) {
      const { error: errorActualizarNombre } = await supabaseAdmin
        .from("contactos")
        .update({ nombre })
        .eq("id", contactoId);

      if (errorActualizarNombre) {
        throw errorActualizarNombre;
      }
    }
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

  // 3) Buscar o crear conversacion
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

  // 4) Insertar mensaje
  const { data: nuevoMensaje, error: errorMensaje } = await supabaseAdmin
    .from("mensajes")
    .insert({
      conversacion_id: conversacionId,
      wa_message_id: waMessageId ?? null,
      direccion: "entrante",
      tipo,
      texto: texto ?? null,
      nombre_archivo: nombreArchivo ?? null,
      mime_type: mimeType ?? null,
      media_id: mediaId ?? null,
      fecha_mensaje: fechaFinal,
      estado_media: mediaId ? "pendiente" : null,
    })
    .select("id")
    .single();

  if (errorMensaje) {
    // ✅ Si la DB ya bloqueó el duplicado por índice único, también lo tratamos aquí
    const mensajeError = String(errorMensaje.message ?? "").toLowerCase();

    if (
      mensajeError.includes("duplicate key") ||
      mensajeError.includes("duplicate") ||
      mensajeError.includes("unique")
    ) {
      console.log("La base detectó duplicado por índice único:", {
        waMessageId,
      });

      const { data: mensajeExistente } = await supabaseAdmin
        .from("mensajes")
        .select("id, conversacion_id")
        .eq("wa_message_id", waMessageId)
        .maybeSingle();

      return {
        duplicado: true,
        mensajeId: mensajeExistente?.id ?? null,
        conversacionId: mensajeExistente?.conversacion_id ?? null,
      };
    }

    throw errorMensaje;
  }

  // 5) Incrementar no leidos solo si realmente fue mensaje nuevo
  const { data: conversacionActual, error: errorConversacionActual } = await supabaseAdmin
    .from("conversaciones")
    .select("mensajes_no_leidos")
    .eq("id", conversacionId)
    .single();

  if (errorConversacionActual) {
    throw errorConversacionActual;
  }

  const cantidadNoLeidos = (conversacionActual?.mensajes_no_leidos ?? 0) + 1;

  const { error: errorActualizarConversacion } = await supabaseAdmin
    .from("conversaciones")
    .update({
      ultima_actividad: fechaFinal,
      mensajes_no_leidos: cantidadNoLeidos,
    })
    .eq("id", conversacionId);

  if (errorActualizarConversacion) {
    throw errorActualizarConversacion;
  }

  // 6) Descargar media solo si el mensaje fue nuevo
  if (mediaId && nuevoMensaje?.id) {
    await descargarYGuardarMedia({
      mediaId,
      mimeType: mimeType ?? null,
      mensajeId: nuevoMensaje.id,
    });
  }

  return {
    duplicado: false,
    mensajeId: nuevoMensaje?.id ?? null,
    conversacionId,
  };
}