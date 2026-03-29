import { obtenerConfiguracionNumeroWhatsapp } from "./obtenerConfiguracionNumeroWhatsapp";

type Params = {
  mediaId: string;
  tipo: "image" | "document";
  nombreArchivo?: string | null;
  telefonoCliente?: string | null;
  numeroWhatsappId?: string | null;
  phoneNumberId?: string | null;
};

export async function reenviarArchivoAlPapa({
  mediaId,
  tipo,
  nombreArchivo,
  telefonoCliente,
  numeroWhatsappId,
  phoneNumberId,
}: Params) {
  try {
    const configNumero = await obtenerConfiguracionNumeroWhatsapp({
      numeroWhatsappId,
      phoneNumberId,
    });

    const apiKey = configNumero.apiKey;
    const destino = configNumero.destinoReenvio?.trim();

    console.log("D360 API key cargada para reenvío", {
      numeroWhatsappId: configNumero.id,
      displayPhoneNumber: configNumero.displayPhoneNumber,
      phoneNumberId: configNumero.phoneNumberId,
      existe: Boolean(apiKey),
      longitud: apiKey.length,
      contieneSaltos: /\r|\n/.test(apiKey),
      inicio: apiKey.slice(0, 6),
      fin: apiKey.slice(-6),
    });

    if (!destino) {
      console.error(
        "Falta destino_reenvio para este número de WhatsApp",
        configNumero
      );
      return;
    }

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

    console.log("Archivo reenviado correctamente al número destino", {
      numeroWhatsappId: configNumero.id,
      displayPhoneNumber: configNumero.displayPhoneNumber,
      destino,
    });
  } catch (error) {
    console.error("Error reenviando archivo al papá:", error);
  }
}