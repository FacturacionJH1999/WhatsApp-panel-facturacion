import { supabaseAdmin } from "../supabaseAdmin";

function normalizarApiKey(valor: string | null | undefined) {
  return valor?.replace(/\s+/g, "").trim() ?? "";
}

type ObtenerConfiguracionNumeroWhatsappParams = {
  numeroWhatsappId?: string | null;
  phoneNumberId?: string | null;
  numeroDestino?: string | null;
};

export async function obtenerConfiguracionNumeroWhatsapp({
  numeroWhatsappId,
  phoneNumberId,
  numeroDestino,
}: ObtenerConfiguracionNumeroWhatsappParams) {
  let query = supabaseAdmin
    .from("numeros_whatsapp")
    .select("id, numero, phone_number_id, api_key, destino_reenvio, activo");

  if (numeroWhatsappId) {
    query = query.eq("id", numeroWhatsappId);
  } else if (phoneNumberId) {
    query = query.eq("phone_number_id", phoneNumberId);
  } else if (numeroDestino) {
    query = query.eq("numero", numeroDestino);
  } else {
    throw new Error(
      "Debes enviar numeroWhatsappId, phoneNumberId o numeroDestino"
    );
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(
      `Error consultando configuración del número WhatsApp: ${error.message}`
    );
  }

  if (!data) {
    throw new Error("No se encontró configuración para el número WhatsApp");
  }

  if (data.activo === false) {
    throw new Error("El número WhatsApp está inactivo");
  }

  const apiKey = normalizarApiKey(data.api_key);

  if (!apiKey) {
    throw new Error(
      `El número ${data.numero ?? data.phone_number_id} no tiene api_key configurada`
    );
  }

  return {
    id: data.id as string,
    numero: (data.numero as string | null) ?? null,
    phoneNumberId: (data.phone_number_id as string | null) ?? null,
    apiKey,
    destinoReenvio: (data.destino_reenvio as string | null) ?? null,
  };
}