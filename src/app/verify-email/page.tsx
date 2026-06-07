"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function VerifyEmailInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Enlace inválido");
      return;
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus("success");
        } else {
          const data = await res.json();
          setErrorMsg(data.error || "Error al verificar");
          setStatus("error");
        }
      })
      .catch(() => {
        setErrorMsg("Error de conexión");
        setStatus("error");
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-primary-500 mb-2">Glycofit</h1>

        {status === "loading" && (
          <>
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto my-6" />
            <p className="text-gray-500">Verificando tu email...</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="text-5xl my-6">&#10003;</div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Email verificado</h2>
            <p className="text-sm text-gray-500 mb-6">Tu cuenta está confirmada. Ya podés usar todas las funciones.</p>
            <a
              href="/dashboard"
              className="inline-block bg-primary-500 hover:bg-primary-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition"
            >
              Ir al inicio
            </a>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-5xl my-6 text-red-500">&#10007;</div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">No se pudo verificar</h2>
            <p className="text-sm text-red-600 mb-6">{errorMsg}</p>
            <a
              href="/login"
              className="inline-block bg-primary-500 hover:bg-primary-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition"
            >
              Volver al inicio de sesión
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    }>
      <VerifyEmailInner />
    </Suspense>
  );
}
