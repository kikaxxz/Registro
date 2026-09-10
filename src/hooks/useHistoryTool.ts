import { useEffect } from "react";
interface HistoryContext {
  registerTool(
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: object;
      execute(input: unknown): unknown;
    },
    options: { signal: AbortSignal },
  ): void | Promise<void>;
}
export function useHistoryTool(read: () => unknown) {
  useEffect(() => {
    const context = (document as Document & { modelContext?: HistoryContext })
      .modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: "read_attendance_summary",
            title: "Consultar resumen de asistencia visible",
            description:
              "Lee el resumen del rango actualmente visible. Solo incluye datos autorizados de la sesión actual. No modifica marcaciones.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute(input) {
              if (
                !input ||
                typeof input !== "object" ||
                Array.isArray(input) ||
                Object.keys(input).length
              )
                throw new Error("Se espera un objeto vacío.");
              return read();
            },
          },
          { signal: controller.signal },
        ),
      ).catch(() => {});
    } catch {
      /* Optional browser capability. */
    }
    return () => controller.abort();
  }, [read]);
}
