# Prueba manual — Bridge → PWA

Registrar resultados anonimizados. No copiar URL privada, token, `sourceId`, `snapshotId`,
cantidades reales, hostname ni rutas personales.

Resultado de la ejecución en iPhone del 18–19 de julio de 2026:
[`PHASE3_MANUAL_TEST_RESULT.md`](./PHASE3_MANUAL_TEST_RESULT.md).

## Datos de ejecución

```text
Fecha:
Dispositivo y sistema operativo:
Navegador / modo PWA:
Versión de Contador Móvil:
Plataforma del bridge: macOS / Windows 11
Resultado general: APROBADO / FALLIDO
```

## Preparación

1. Confirmar Tailscale conectado en teléfono y computadora.
2. Iniciar la API privada y las rutas explícitas de Tailscale Serve.
3. Disponer de un token `snapshot:read` vigente.
4. Confirmar que Excel ya publicó un snapshot real.
5. Abrir o instalar la PWA desde el origen de producción autorizado.

## Perfil e identidad

| Caso | Resultado | Observación anonimizada |
|---|---|---|
| Crear perfil con alias, URL HTTPS y token |  |  |
| El token aparece enmascarado y puede revelarse temporalmente |  |  |
| HTTP, loopback, path, query y puerto directo se rechazan |  |  |
| Verificar muestra la identidad antes de vincular |  |  |
| Cancelar la confirmación deja el perfil sin verificar |  |  |
| Confirmar persiste la identidad |  |  |
| Editar alias funciona |  |  |
| Reemplazar URL o token exige nueva verificación operativa |  |  |
| Seleccionar perfil activo persiste después de reiniciar la PWA |  |  |

## Caja y sincronización

| Caso | Resultado | Observación anonimizada |
|---|---|---|
| Sin perfiles muestra acceso a Ajustes |  |  |
| Perfil sin verificar no permite sincronizar |  |  |
| Sin snapshot muestra estado vacío |  |  |
| Sincronizar consulta identidad y último snapshot |  |  |
| Total coincide con Excel |  |  |
| Las seis denominaciones coinciden y conservan orden |  |  |
| Los negativos permanecen exactos y muestran advertencia textual |  |  |
| Se muestran generado, recibido y sincronizado |  |  |
| El botón queda deshabilitado mientras sincroniza |  |  |
| No aparecen peticiones periódicas |  |  |
| Cerrar y abrir la PWA conserva el snapshot |  |  |

## Fallos y offline

Para cada caso debe permanecer visible el snapshot anterior y no debe aparecer una excepción
sin manejar.

| Caso | Resultado | Observación anonimizada |
|---|---|---|
| Bridge apagado |  |  |
| Tailscale apagado |  |  |
| Teléfono sin conexión después de una sync válida |  |  |
| Token inválido |  |  |
| Token revocado |  |  |
| Scope insuficiente |  |  |
| Snapshot no encontrado |  |  |
| Respuesta o versión incompatible |  |  |
| Cambiar de perfil durante una petición cancela/ignora el resultado |  |  |
| Desmontar Caja durante una petición no produce errores |  |  |

## Identidad incompatible y re-vinculación

1. Configurar temporalmente el perfil con una URL de otra identidad autorizada.
2. Sincronizar y confirmar `SOURCE_MISMATCH`.
3. Verificar que el snapshot anterior sigue visible y no se guardó el nuevo.
4. Cancelar la re-vinculación y confirmar que nada cambia.
5. Repetir, confirmar la re-vinculación y comprobar que se elimina el snapshot anterior.
6. Sincronizar nuevamente y verificar que el dato nuevo pertenece a la identidad confirmada.

```text
Mismatch bloqueado:
Cancelación conserva perfil y snapshot:
Re-vinculación elimina snapshot anterior:
Nueva sincronización correcta:
Resultado: APROBADO / FALLIDO
```

## Dos perfiles

1. Registrar un bridge macOS y uno Windows 11.
2. Verificar ambas identidades.
3. Sincronizar cada perfil y comparar con su Excel correspondiente.
4. Cambiar el perfil activo varias veces.
5. Apagar uno de los bridges y confirmar que el snapshot del otro no cambia.
6. Eliminar un perfil inactivo y confirmar que el otro permanece.
7. Eliminar el perfil activo y confirmar que la aplicación queda sin perfil activo.

```text
Snapshots independientes:
Cambio activo correcto:
Fallo aislado por perfil:
Cascada al eliminar:
Resultado: APROBADO / FALLIDO
```

## Instalación, almacenamiento y actualización

| Caso | Resultado | Observación anonimizada |
|---|---|---|
| Instalación en pantalla de inicio |  |  |
| Safe areas y viewport en modo standalone |  |  |
| Pegado desde gestor de contraseñas |  |  |
| IndexedDB permanece tras cerrar/reabrir |  |  |
| Advertencia visible si storage persistente es rechazado |  |  |
| Actualizar la PWA activa el build nuevo sin perder v1/v2 |  |  |
| Service worker no devuelve respuestas cacheadas de la API |  |  |

## Matriz final

| Cliente | Bridge | Perfil | Sync | Offline | Identidad | Dos perfiles | Resultado |
|---|---|---|---|---|---|---|---|
| iPhone / Safari PWA | macOS |  |  |  |  |  |  |
| iPhone / Safari PWA | Windows 11 |  |  |  |  |  |  |
| Android / Chrome PWA | macOS o Windows 11 |  |  |  |  |  |  |

## Incidencias

```text
Plataforma y versión:
Caso:
Código local mostrado:
Petición observada: SÍ / NO
El snapshot anterior se conservó: SÍ / NO
Resultado después de repetir:
Acción siguiente:
```
