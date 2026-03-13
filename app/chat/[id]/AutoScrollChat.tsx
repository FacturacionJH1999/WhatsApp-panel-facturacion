"use client";

import { useEffect } from "react";

export function AutoScrollChat() {
  useEffect(() => {
    const contenedor = document.getElementById("contenedor-mensajes");

    if (!contenedor) return;

    contenedor.scrollTop = contenedor.scrollHeight;
  }, []);

  return null;
}