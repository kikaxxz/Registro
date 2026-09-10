import { Component, type ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="access-state">
          <h1>No se pudo abrir esta vista</h1>
          <p>
            Recarga la aplicación. Si estabas marcando, revisa el estado de tu
            jornada antes de volver a intentarlo.
          </p>
          <button className="primary" onClick={() => location.reload()}>
            Recargar aplicación
          </button>
        </main>
      );
    return this.props.children;
  }
}
