# Revisión de seguridad vigente · 2026-09-08

## Acceso desde cualquier red

El 2026-09-08 el usuario pidió retirar la restricción de red. El Worker ya no compara CF-Connecting-IP ni exige COMPANY_IP. Sigue verificando origen de aplicación, token Firebase, cuenta activa, primer ingreso y permisos para cada operación. El endpoint /network permite continuar a clientes antiguos en caché; no entrega datos ni autoriza operaciones sin sesión.

Firestore continúa denegando accesos directos del cliente. El cambio no restablece contraseñas, modifica roles ni borra registros. Las pruebas cubren IPv4, IPv6 y ausencia de cabecera de IP, con rechazo de sesiones ausentes o inválidas y orígenes ajenos.

## Primer ingreso

Los cuatro usuarios solicitados se aprovisionan en un entorno administrativo. Denis conserva el rol jefe y canRegister=true. Una cuenta existente solo se adopta si su perfil administrativo coincide con el usuario. La contraseña temporal se asigna mediante Admin SDK y se revocan sesiones anteriores. No existe autorregistro de perfiles.

mustChangePassword=true impide consultas, configuración y asistencia en el backend; /session entrega únicamente el perfil propio para completar el proceso. La contraseña nueva se valida (mínimo seis caracteres, mayúscula, minúscula y número), se compara con el hash temporal y se cambia en Firebase con el token propio. Solo tras éxito se guarda el nombre completo y se libera el acceso en Firestore. Un fallo mantiene el bloqueo. Si Firebase cambió la contraseña pero la escritura posterior falló, se inicia sesión con la nueva para reintentar; no se habilita acceso parcial.

Las contraseñas no se imprimen ni registran en logs. Los hashes temporales están en onboardingSecrets, nunca se devuelven al navegador y se eliminan al terminar. Las credenciales de entrega se guardan únicamente en .private-access/usuarios-temporales.html, excluido de Git y Hosting.

## Datos y roles

Las consultas de trabajador fuerzan su UID. Jefatura puede consultar el personal y configurar el horario con detección de cambios concurrentes. Denis puede registrar su propia jornada. La identidad del registro se obtiene del perfil del servidor, incluido el nombre completo; no se acepta un nombre o UID proporcionado por el formulario.

La jornada usa un ID determinista por usuario y fecha; la transacción rechaza duplicados y conserva submittedAt del servidor. Los horarios declarados se validan por fecha, orden, máximo 24 horas y ausencia de futuro. No hay edición ni borrado de jornadas desde la API. PDF toma los registros del filtro cargado.

## Verificación

23 pruebas unitarias (incluidas pruebas históricas de firmas), dos escenarios de reglas con múltiples denegaciones para todos los roles y colecciones, y un flujo completo con Auth/Firestore emulados. Producción: cuatro contraseñas temporales aceptadas por Firebase sin completar el primer ingreso, roles y estados comprobados, Firestore directo denegado, historial vacío y build de Hosting coincidente. No se cambió la contraseña personal de ninguna persona: cada titular completa ese paso.

Se retiraron las rutas de vinculación de dispositivo; sus antiguas políticas ya no forman parte de la autorización. Los dos registros históricos fueron eliminados por solicitud explícita, sin eliminar cuentas adicionales. La aceptación visual y desde el Wi-Fi empresarial queda a prueba del usuario, dado que esta sesión no dispone de navegador interactivo ni conexión desde la IP autorizada.
