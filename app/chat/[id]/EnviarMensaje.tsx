"use client";

import { useRef, useState } from "react";

type EnviarMensajeProps = {
  telefono: string;
  puedeEnviar?: boolean;
};

export function EnviarMensaje({
  telefono,
  puedeEnviar = true,
}: EnviarMensajeProps) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const inputArchivoRef = useRef<HTMLInputElement | null>(null);

  async function enviarTexto() {
    if (!puedeEnviar || !texto.trim() || !telefono || enviando) return;

    setEnviando(true);

    try {
      const response = await fetch("/api/whatsapp/enviar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          telefono,
          texto: texto.trim(),
          tipo: "text",
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 401) {
          console.error("Sesión no válida:", data);
        } else if (response.status === 403) {
          console.error("Usuario sin permisos para enviar mensajes:", data);
        } else {
          console.error("Error enviando mensaje:", {
            status: response.status,
            data,
          });
        }

        return;
      }

      setTexto("");
      window.location.reload();
    } catch (error) {
      console.error("Error enviando mensaje:", error);
    } finally {
      setEnviando(false);
    }
  }

  async function manejarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!puedeEnviar || !archivo || !telefono || enviando) return;

    setEnviando(true);

    try {
      const formData = new FormData();
      formData.append("file", archivo);

      const subida = await fetch("/api/whatsapp/subir-media", {
        method: "POST",
        body: formData,
      });

      const subidaData = await subida.json().catch(() => null);

      if (!subida.ok || !subidaData?.id) {
        if (subida.status === 401) {
          console.error("Sesión no válida:", subidaData);
        } else if (subida.status === 403) {
          console.error("Usuario sin permisos para subir archivos:", subidaData);
        } else {
          console.error("Error subiendo media:", {
            status: subida.status,
            data: subidaData,
          });
        }

        return;
      }

      let tipo: "image" | "video" | "document" = "document";

      if (archivo.type.startsWith("image/")) tipo = "image";
      else if (archivo.type.startsWith("video/")) tipo = "video";

      const envio = await fetch("/api/whatsapp/enviar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          telefono,
          tipo,
          mediaId: subidaData.id,
          mimeType: archivo.type || null,
          nombreArchivo: archivo.name,
        }),
      });

      const envioData = await envio.json().catch(() => null);

      if (!envio.ok) {
        if (envio.status === 401) {
          console.error("Sesión no válida:", envioData);
        } else if (envio.status === 403) {
          console.error("Usuario sin permisos para enviar archivos:", envioData);
        } else {
          console.error("Error enviando media:", {
            status: envio.status,
            data: envioData,
          });
        }

        return;
      }

      window.location.reload();
    } catch (error) {
      console.error("Error enviando archivo:", error);
    } finally {
      setEnviando(false);

      if (inputArchivoRef.current) {
        inputArchivoRef.current.value = "";
      }
    }
  }

  if (!puedeEnviar) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        Esta conversación está en modo solo lectura.
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => inputArchivoRef.current?.click()}
        disabled={enviando || !telefono}
        className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Adjuntar
      </button>

      <input
        ref={inputArchivoRef}
        type="file"
        className="hidden"
        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        onChange={manejarArchivo}
      />

      <input
        type="text"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            enviarTexto();
          }
        }}
        placeholder="Escribe un mensaje..."
        className="flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none"
      />

      <button
        type="button"
        onClick={enviarTexto}
        disabled={enviando || !texto.trim() || !telefono}
        className="rounded-xl bg-neutral-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enviando ? "Enviando..." : "Enviar"}
      </button>
    </div>
  );
}