"use client";

import { useRef, useState } from "react";

export function EnviarMensaje({ telefono }: { telefono: string }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const inputArchivoRef = useRef<HTMLInputElement | null>(null);

  async function enviarTexto() {
    if (!texto.trim() || !telefono || enviando) return;

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

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        console.error("Error enviando mensaje:", data);
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
    if (!archivo || !telefono || enviando) return;

    setEnviando(true);

    try {
      const formData = new FormData();
      formData.append("file", archivo);

      const subida = await fetch("/api/whatsapp/subir-media", {
        method: "POST",
        body: formData,
      });

      const subidaData = await subida.json();

      if (!subida.ok || !subidaData?.id) {
        console.error("Error subiendo media:", subidaData);
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

      const envioData = await envio.json();

      if (!envio.ok) {
        console.error("Error enviando media:", envioData);
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