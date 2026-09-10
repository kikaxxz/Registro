# Instrucciones del proyecto

- Leer las Firebase agent skills apropiadas de `.agents/skills/` antes de trabajar en Firebase. Proyecto existente `registro-elec`, app `1:673227073874:web:beddbbb0e3f35fcfbf728b`, Firestore Standard `(default)` en `nam5`.
- Mantener costo $0: Spark y Workers gratuito; no vincular facturación ni activar Blaze, Functions, SMS, Storage o App Hosting.
- El flujo vigente reemplaza los enlaces de primera activación: cuentas aprovisionadas administrativamente con contraseña temporal. En el primer ingreso deben cambiarla y completar nombre y apellidos. Mantener el bloqueo de datos y operaciones en el backend hasta completarlo. Mínimo 6 caracteres, mayúscula, minúscula y número; rechazar reutilizar la temporal.
- Usuarios preparados: `denis` (jefe y participante), `andy`, `chele`, `alvaro` (trabajadores). Nombres de usuario sin distinción de mayúsculas. No volver a ejecutar `scripts/prepare-team.mjs --apply` sin una solicitud explícita de restablecer esas cuentas. Credenciales privadas en `.private-access/usuarios-temporales.html`; jamás imprimirlas en logs, incluirlas en frontend o Git.
- `jefatura` conserva la administración independiente y su contraseña; `canRegister:false`. Enrique sigue existente. No eliminar cuentas adicionales sin solicitud.
- Denis puede registrar sus propias jornadas y consultar/configurar como jefe. El nombre completo se copia a cada registro y se usa en PDF.
- El usuario retiró la restricción de red. Permitir cualquier conexión a Internet, manteniendo sesión Firebase, primer ingreso completo, roles y propiedad. Todas las consultas y escrituras siguen pasando por el Worker y Firestore deniega accesos directos del cliente. No volver a habilitar una lista de IP sin solicitud.
- La vinculación de dispositivos se retiró de la interfaz y rutas de producción por petición del usuario. Worker existente `https://registro-device-api.registro-electricidad.workers.dev` reutilizado como API de negocio. No regenerar la clave de servicio instalada salvo rotación autorizada. `DEVICE-ACCESS.md` documenta su retirada.
- Horarios escritos: fecha actual o anterior, entrada y salida completas, una jornada manual por día, salida nocturna explícita. `entryTime` y `exitTime` declarados; `submittedAt` de servidor. Cada panel una función; PDF desde Historial respeta filtros y nombres completos.
- El 2026-09-08 se eliminaron por solicitud expresa los 2 documentos de asistencia existentes; `activeShifts` estaba vacío. No volver a limpiar datos nuevos sin solicitud.
- Animaciones CSS discretas en navegación, paneles y feedback; respetar `prefers-reduced-motion`.
- Validar permisos y primer ingreso con pruebas unitarias, Firestore emulado y Auth emulado. La red ya no forma parte de la autorización.
