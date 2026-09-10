# Retirada de vinculación de dispositivos

El 2026-09-08 el usuario pidió retirar el requisito de dispositivo y conservar la restricción de red empresarial. Se eliminó el panel de navegación y las rutas WebAuthn de producción. No se exige aprobación, registro ni firma de dispositivo para guardar.

Se reutiliza el Worker ya instalado como API de negocio, sin regenerar secretos ni cambiar de plan. Posteriormente el usuario también retiró la restricción de red. Todas las lecturas y escrituras pasan por la verificación de sesión, perfil y permisos, sin filtro de IP. Firestore deniega acceso directo a todos los clientes.

Los módulos anteriores de WebAuthn y sus pruebas permanecen como implementación histórica sin rutas activas. Sus documentos no conceden ni restringen el acceso actual. No reactivar ese flujo sin una nueva solicitud.

El alta vigente usa contraseña temporal y primer ingreso obligatorio con nombre completo y nueva contraseña. Consultar README.md y AGENTS.md.
