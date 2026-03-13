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
  if (!API_KEY || !DESTINO || !mediaId) return;

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

  await fetch("https://waba-v2.360dialog.io/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "D360-API-KEY": API_KEY,
    },
    body: JSON.stringify(payload),
  });

  await fetch("https://waba-v2.360dialog.io/messages", {
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
  });
}