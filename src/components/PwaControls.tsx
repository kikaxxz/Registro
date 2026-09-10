import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Download, RefreshCw, X } from "lucide-react";
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function PwaControls({
  updatesOnly = false,
}: {
  updatesOnly?: boolean;
}) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [help, setHelp] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const installed = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  async function install() {
    if (!prompt) {
      setHelp(!help);
      return;
    }
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  }
  return (
    <>
      {!updatesOnly && (
        <button
          className="install-button"
          aria-label="Instalar aplicación"
          title="Instalar aplicación"
          onClick={install}
        >
          <Download size={17} />
          <span>Instalar aplicación</span>
        </button>
      )}
      {help && (
        <div className="pwa-toast" role="status">
          <div>
            <strong>Instala Registro</strong>
            <p>
              En iPhone: abre Safari, pulsa Compartir y «Añadir a pantalla de
              inicio». En Android o PC: busca «Instalar aplicación» en el menú
              del navegador.
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Cerrar instrucciones"
            onClick={() => setHelp(false)}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {needRefresh && (
        <div className="pwa-toast" role="status">
          <div>
            <strong>Hay una nueva versión</strong>
            <p>Termina cualquier marcación antes de actualizar.</p>
            <button
              className="primary"
              onClick={() => updateServiceWorker(true)}
            >
              <RefreshCw size={16} />
              Actualizar
            </button>
          </div>
          <button
            className="icon-button"
            aria-label="Actualizar más tarde"
            onClick={() => setNeedRefresh(false)}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </>
  );
}
