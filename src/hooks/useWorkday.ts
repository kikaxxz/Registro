import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { WorkSettings } from "../types";
import { errorMessage } from "../utils/errors";
export function useWorkday() {
  const [settings, setSettings] = useState<WorkSettings | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    api<{ settings: WorkSettings }>("/settings/get")
      .then((d) => {
        if (current) setSettings(d.settings);
      })
      .catch((e) => {
        if (current) setError(errorMessage(e));
      });
    return () => {
      current = false;
    };
  }, []);
  return { settings, error };
}
