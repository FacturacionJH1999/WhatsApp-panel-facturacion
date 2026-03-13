const API_KEY = process.env.D360_API_KEY;
const DESTINO = process.env.WHATSAPP_DESTINO_FACTURAS;

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
    if (!API_KEY) {
      console.error("Falta D360_API_KEY");
      return;
    }

    if (!DESTINO) {
      console.error("Falta WHATSAPP_DESTINO_FACTURAS");
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
        to: DESTINO,
        type: "image",
        image: {
          id: mediaId,
        },
      };
    } else {
      payload = {
        messaging_product: "whatsapp",
        to: DESTINO,
        type: "document",
        document: {
          id: mediaId,
          filename: nombreArchivo ?? "archivo",
        },
      };
    }

    const respuestaArchivo = await fetch(
      "https://waba-v2.360dialog.io/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "D360-API-KEY": API_KEY,
        },
        body: JSON.stringify(payload),
      }
    );

    const dataArchivo = await respuestaArchivo.json();

    if (!respuestaArchivo.ok) {
      console.error("Error reenviando archivo:", dataArchivo);
      return;
    }

    const respuestaTexto = await fetch(
      "https://waba-v2.360dialog.io/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "D360-API-KEY": API_KEY,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: DESTINO,
          type: "text",
          text: {
            body: textoContexto,
          },
        }),
      }
    );

    const dataTexto = await respuestaTexto.json();

    if (!respuestaTexto.ok) {
      console.error("Error enviando mensaje de contexto:", dataTexto);
    }

    console.log("Archivo reenviado correctamente al número destino");
  } catch (error) {
    console.error("Error reenviando archivo al papá:", error);
  }
}