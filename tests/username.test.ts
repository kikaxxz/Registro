import { describe, expect, it } from "vitest";
import { normalizeUsername, usernameEmail } from "../src/utils/username";
describe("Identidad por nombre de usuario", () => {
  it("normaliza Denis y elimina espacios o acentos sin confundir otros nombres", () => {
    expect(normalizeUsername("  Dénis ")).toBe("denis");
    expect(usernameEmail("Denis")).toBe("denis@registro-elec.invalid");
    expect(usernameEmail("denis.2")).not.toBe(usernameEmail("Denis"));
  });
  it("rechaza rutas, correos y valores fuera de los límites", () => {
    for (const input of [
      "",
      "ab",
      "../denis",
      "denis/otro",
      "denis@ejemplo.com",
      "d".repeat(33),
    ])
      expect(() => normalizeUsername(input)).toThrow();
  });
});
