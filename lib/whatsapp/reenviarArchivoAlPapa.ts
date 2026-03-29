function normalizarApiKey(valor: string | undefined) {
  return valor?.replace(/\s+/g, "").trim() ?? "";
}

function obtenerApiKey360() {
  const apiKeyRaw = process.env.D360_API_KEY;
  const apiKey = normalizarApiKey(apiKeyRaw);

  if (!apiKey) {
    throw new Error("Falta D360_API_KEY");
  }

  return apiKey;
}

function obtenerDestinoFacturas() {
  const destino = process.env.WHATSAPP_DESTINO_FACTURAS?.trim();

  if (!destino) {
    throw new Error("Falta WHATSAPP_DESTINO_FACTURAS");
  }

  return destino;
}

type Params = {
  mediaId: string;
  tipo: "image" | "document";
  nombreArchivo?: string | null;
  telefonoCliente?: string | null;
};

export async function reenviarArchivoAlPapa({
  mediaId,
  tipo,
  nombreArchivo,
  telefonoCliente,
}: Params) {
  try {
    const apiKey = obtenerApiKey360();
    const destino = obtenerDestinoFacturas();

    console.log("D360 API key cargada para reenvío", {
      existe: Boolean(apiKey),
      longitud: apiKey.length,
      contieneSaltos: /\r|\n/.test(apiKey),
      inicio: apiKey.slice(0, 6),
      fin: apiKey.slice(-6),
    });

    if (!mediaId) {
      console.error("mediaId vacío, no se puede reenviar");
      return;
    }

    const textoContexto = telefonoCliente
      ? `Archivo recibido desde ${telefonoCliente}`
      : "Archivo recibido";

    let payload: Record<string, unknown>;

    if (tipo === "image") {
      payload = {
        messaging_product: "whatsapp",
        to: destino,
        type: "image",
        image: {
          id: mediaId,
        },
      };
    } else {
      payload = {
        messaging_product: "whatsapp",
        to: destino,
        type: "document",
        document: {
          id: mediaId,
          filename: nombreArchivo ?? "archivo",
        },
      };
    }

    const headers = {
      "Content-Type": "application/json",
      "D360-API-KEY": apiKey,
    };

    const respuestaArchivo = await fetch(
      "https://waba-v2.360dialog.io/messages",
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }
    );

    const dataArchivo = await respuestaArchivo.json().catch(() => null);

    if (!respuestaArchivo.ok) {
      console.error("Error reenviando archivo:", dataArchivo);
      return;
    }

    const respuestaTexto = await fetch(
      "https://waba-v2.360dialog.io/messages",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: destino,
          type: "text",
          text: {
            body: textoContexto,
          },
        }),
      }
    );

    const dataTexto = await respuestaTexto.json().catch(() => null);

    if (!respuestaTexto.ok) {
      console.error("Error enviando mensaje de contexto:", dataTexto);
      return;
    }

    console.log("Archivo reenviado correctamente al número destino");
  } catch (error) {
    console.error("Error reenviando archivo al papá:", error);
  }
}