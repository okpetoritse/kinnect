"use client";

import { useEffect } from "react";

export default function DebugConsole() {
  useEffect(() => {
    if (document.getElementById("eruda-script")) return;

    const script = document.createElement("script");
    script.id = "eruda-script";
    script.src = "https://cdn.jsdelivr.net/npm/eruda";
    script.onload = () => {
      (window as any).eruda.init();
    };
    document.body.appendChild(script);
  }, []);

  return null;
}