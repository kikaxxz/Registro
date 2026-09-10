# Registro · Electricidad

Aplicación publicada: https://registro-elec.web.app/

## Acceso vigente

Usuarios: Denis, Andy, Chele y Alvaro. Denis conserva rol de jefe y puede registrar su propia jornada. Cada persona recibe una contraseña temporal privada; el primer ingreso obliga a completar nombre y apellidos y cambiar la contraseña. La nueva contraseña debe ser diferente de la temporal, con mínimo 6 caracteres, mayúscula, minúscula y número.

Las contraseñas temporales no caducan por tiempo; se reemplazan al completar el primer ingreso. El archivo `.private-access/usuarios-temporales.html` es solo para el administrador. Entregar a cada persona únicamente sus datos. La recuperación requiere verificar identidad y restablecer administrativamente una contraseña temporal; conocer el usuario no permite recuperar acceso.

`jefatura` sigue siendo una cuenta administrativa independiente, sin registro de jornada. Las cuentas previamente existentes que no fueron mencionadas se conservaron.

## Acceso y permisos

El usuario retiró la restricción de red el 2026-09-08. Se puede acceder desde cualquier conexión a Internet. La API sigue verificando la sesión Firebase, el perfil activo, el primer ingreso completo y el rol/propietario.

Todas las consultas y escrituras pasan por el Worker existente. Firestore deniega los accesos directos del navegador. Se eliminó COMPANY_IP de la configuración y la comprobación previa al login. /network conserva una respuesta permitida para compatibilidad con versiones en caché.

Se retiró el requisito de dispositivo: no hay botones ni rutas activas de WebAuthn. Los archivos anteriores de esa implementación son código histórico; no tienen rutas públicas en el Worker actual.

## Paneles

- Registro: fecha, entrada y salida; días anteriores permitidos, una jornada por fecha, hasta 24 horas, sin horas futuras. Salida al día siguiente explícita.
- Historial: fechas y trabajador, totales y PDF del filtro cargado. El nombre completo se guarda en cada jornada y aparece en el PDF.
- Personal: listado de participantes, incluido Denis.
- Configuración: horario de referencia y umbral de horas extra.

Los horarios son declarados por el trabajador. `submittedAt` conserva la confirmación de servidor. Los registros son inmutables. Las horas extra se calculan como máximo(0, minutos trabajados - minutos normales), sin descontar pausas. Cada jornada conserva la política vigente al guardarse. Las consultas abarcan hasta 93 días y 10 000 registros.

El 2026-09-08 se eliminaron los dos registros anteriores a petición del usuario. No hay borrado automático de registros nuevos.

## Implementación

React, TypeScript y Vite; Firebase Authentication y Firestore Standard; Firebase Hosting; Cloudflare Workers. Firebase permanece en Spark y no se contrató facturación. Animaciones CSS en paneles, botones y avisos con soporte de movimiento reducido. PDF generado localmente con jsPDF y AutoTable, sin servicio externo.

`cloudflare/src/business.mjs` administra perfil, primer ingreso, guardado, consultas y configuración. `cloudflare/src/index.mjs` impone red y sesión antes de cada ruta. `onboardingSecrets/{uid}` contiene únicamente el hash de la contraseña temporal y se elimina al completar el proceso. La contraseña nueva se envía a Firebase con el token del propio usuario, sin necesitar ampliar privilegios de la cuenta de servicio.

## Desarrollo y pruebas

```powershell
npm install
npm test
npm run test:rules
npm run test:auth
npm run build
```

Las pruebas de reglas requieren Java 21 y puertos de emuladores libres. Auth y Firestore emulados prueban cambio real de contraseña temporal, seis caracteres, bloqueo del primer ingreso, nombre completo y registro del jefe. Las pruebas de servidor cubren acceso desde cualquier IP, sesión obligatoria, roles, suplantación, duplicados y fallos de cambio de contraseña. La retirada del control de red no modifica los permisos ni el requisito de completar el primer ingreso.

## Publicación y administración

Usar el proyecto y la cuenta existentes. Los secretos ya están instalados en el Worker; no volver a ejecutar el configurador de claves.

```powershell
node scripts/check-deploy.mjs
npm run build
npx wrangler deploy --config cloudflare/wrangler.jsonc
node node_modules/firebase-tools/lib/bin/firebase.js deploy --only firestore:rules --project registro-elec --non-interactive
node node_modules/firebase-tools/lib/bin/firebase.js deploy --only hosting --project registro-elec --non-interactive
```

`scripts/prepare-team.mjs` sin flags muestra un plan. `--apply` RESTABLECE las cuatro contraseñas y el primer ingreso; `--clear-attendance` elimina asistencia y bloqueos si también se usa `--apply`. Son operaciones administrativas para solicitudes explícitas, no pasos de despliegue habituales. Los antiguos scripts de enlaces/provisión no representan el flujo vigente.

La PWA conserva solo la interfaz en caché; no encola registros sin conexión. Pulsa Actualizar cuando se publique una versión nueva.
