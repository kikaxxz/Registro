export function normalizeUsername(value: string): string {
  const username = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (!/^[a-z][a-z0-9._-]{2,31}$/.test(username))
    throw new Error(
      "El usuario debe tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo.",
    );
  return username;
}
export function usernameEmail(value: string) {
  return `${normalizeUsername(value)}@registro-elec.invalid`;
}
