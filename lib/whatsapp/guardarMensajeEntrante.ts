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

function normalizarTexto(texto: string | null | undefined) {
  if (typeof texto !== "string") return null;
  const limpio = texto.trim();
  return limpio.length > 0 ? limpio : null;
}

function calcularEstadoMedia(tipo: string) {
  const tiposConMedia = new Set(["image", "document", "video", "audio"]);
  return tiposConMedia.has(tipo) ? "pendiente" : "no_aplica";
}

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
  const textoNormalizado = normalizarTexto(texto);
  const estadoMedia = calcularEstadoMedia(tipo);

  console.log("guardarMensajeEntrante() inicio:", {
    telefono,
    nombre,
    waMessageId,
    tipo,
    textoOriginal: texto ?? null,
    textoNormalizado,
    nombreArchivo: nombreArchivo ?? null,
    mimeType: mimeType ?? null,
    mediaId: mediaId ?? null,
    fechaFinal,
    estadoMedia,
  });

  if (waMessageId) {
    const { data: mensajeExistente, error: errorMensajeExistente } =
      await supabaseAdmin
        .from("mensajes")
        .select("id, conversacion_id")
        .eq("wa_message_id", waMessageId)
        .maybeSingle();

    if (errorMensajeExistente) {
      console.error(
        "Error buscando mensaje existente por wa_message_id:",
        errorMensajeExistente
      );
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

  const { data: contactoExistente, error: errorContactoBusqueda } =
    await supabaseAdmin
      .from("contactos")
      .select("id, nombre")
      .eq("telefono", telefono)
      .maybeSingle();

  if (errorContactoBusqueda) {
    console.error("Error buscando contacto:", errorContactoBusqueda);
    throw errorContactoBusqueda;
  }

  if (contactoExistente?.id) {
    contactoId = contactoExistente.id;

    if (nombre && !contactoExistente.nombre) {
      const { error: errorActualizarNombre } = await supabaseAdmin
        .from("contactos")
        .update({ nombre })
        .eq("id", contactoId);

      if (errorActualizarNombre) {
        console.error(
          "Error actualizando nombre del contacto:",
          errorActualizarNombre
        );
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
      console.error("Error creando contacto:", errorNuevoContacto);
      throw errorNuevoContacto;
    }

    if (!nuevoContacto?.id) {
      throw new Error("No se pudo crear el contacto");
    }

    contactoId = nuevoContacto.id;
  }

  const { data: conversacionExistente, error: errorConversacionBusqueda } =
    await supabaseAdmin
      .from("conversaciones")
      .select("id")
      .eq("contacto_id", contactoId)
      .maybeSingle();

  if (errorConversacionBusqueda) {
    console.error("Error buscando conversación:", errorConversacionBusqueda);
    throw errorConversacionBusqueda;
  }

  if (conversacionExistente?.id) {
    conversacionId = conversacionExistente.id;
  } else {
    const { data: nuevaConversacion, error: errorNuevaConversacion } =
      await supabaseAdmin
        .from("conversaciones")
        .insert({
          contacto_id: contactoId,
        })
        .select("id")
        .single();

    if (errorNuevaConversacion) {
      console.error("Error creando conversación:", errorNuevaConversacion);
      throw errorNuevaConversacion;
    }

    if (!nuevaConversacion?.id) {
      throw new Error("No se pudo crear la conversación");
    }

    conversacionId = nuevaConversacion.id;
  }

  const payloadMensaje = {
    conversacion_id: conversacionId,
    wa_message_id: waMessageId ?? null,
    direccion: "entrante" as const,
    tipo,
    texto: textoNormalizado,
    nombre_archivo: nombreArchivo ?? null,
    mime_type: mimeType ?? null,
    media_id: mediaId ?? null,
    fecha_mensaje: fechaFinal,
    estado_media: estadoMedia,
  };

  console.log("Insertando mensaje en Supabase:", payloadMensaje);

  const { data: nuevoMensaje, error: errorMensaje } = await supabaseAdmin
    .from("mensajes")
    .insert(payloadMensaje)
    .select("id")
    .single();

  if (errorMensaje) {
    const mensajeError = String(errorMensaje.message ?? "").toLowerCase();

    console.error("Error insertando mensaje:", errorMensaje, payloadMensaje);

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

  const { data: conversacionActual, error: errorConversacionActual } =
    await supabaseAdmin
      .from("conversaciones")
      .select("mensajes_no_leidos")
      .eq("id", conversacionId)
      .single();

  if (errorConversacionActual) {
    console.error(
      "Error leyendo conversación actual:",
      errorConversacionActual
    );
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
    console.error(
      "Error actualizando conversación:",
      errorActualizarConversacion
    );
    throw errorActualizarConversacion;
  }

  if (mediaId && nuevoMensaje?.id) {
    await descargarYGuardarMedia({
      mediaId,
      mimeType: mimeType ?? null,
      mensajeId: nuevoMensaje.id,
    });
  }

  console.log("guardarMensajeEntrante() completado:", {
    duplicado: false,
    mensajeId: nuevoMensaje?.id ?? null,
    conversacionId,
  });

  return {
    duplicado: false,
    mensajeId: nuevoMensaje?.id ?? null,
    conversacionId,
  };
}