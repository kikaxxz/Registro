export function errorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (
    ["auth/expired-action-code", "auth/invalid-action-code"].includes(
      code ?? "",
    )
  )
    return "Este enlace venció o ya fue utilizado. Solicita uno nuevo al administrador.";
  if (
    [
      "auth/invalid-credential",
      "auth/user-not-found",
      "auth/wrong-password",
    ].includes(code ?? "")
  )
    return "El correo o la contraseña no son correctos.";
  if (code === "auth/too-many-requests")
    return "Demasiados intentos. Espera unos minutos y vuelve a intentar.";
  if (code === "auth/user-disabled")
    return "Esta cuenta está deshabilitada. Contacta al jefe del área.";
  if (code === "auth/invalid-email") return "Escribe un correo válido.";
  if (
    ["auth/configuration-not-found", "auth/operation-not-allowed"].includes(
      code ?? "",
    )
  )
    return "El administrador debe activar Correo/contraseña en Firebase Authentication antes del primer acceso.";
  if (code === "permission-denied")
    return "No tienes permiso para esta operación. Revisa con el jefe del área si tu cuenta sigue activa.";
  if (code === "failed-precondition")
    return "La base de datos necesita completar su configuración o sus índices. Contacta al administrador.";
  if (code === "resource-exhausted")
    return "Se alcanzó el límite del servicio. Contacta al administrador.";
  if (["unavailable", "auth/network-request-failed"].includes(code ?? ""))
    return "No se pudo conectar. Comprueba tu conexión y vuelve a intentar.";
  return error instanceof Error && !code
    ? error.message
    : "No se pudo completar la operación. Vuelve a intentar.";
}
