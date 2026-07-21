# Resultado de prueba manual — Bridge → PWA

## Resumen

Ejecución realizada el 18 y 19 de julio de 2026 siguiendo
[`PHASE3_MANUAL_TEST.md`](./PHASE3_MANUAL_TEST.md). El reporte está sanitizado: no contiene
URLs privadas, tokens, hostnames, identidades, IDs, cantidades reales ni rutas personales.

```text
Dispositivo: iPhone 15 Pro Max
Sistema operativo: iOS 26.5.2
Modo: PWA instalada / Safari
Versión de Contador Móvil: 0.3.0
Bridges: macOS y Windows 11
Commit de producción visible: sí, valor omitido
Resultado iPhone: APROBADO; CORRECCIÓN VISUAL PENDIENTE DE REVALIDACIÓN MANUAL
Resultado Android: PENDIENTE POR DISPOSITIVO NO DISPONIBLE
```

## Criterios de resultado

- **APROBADO**: el comportamiento esperado se comprobó físicamente.
- **NO COMPROBABLE**: el estado previo necesario ya no estaba disponible y no se alteraron
  datos reales para recrearlo.
- **NO EJECUTABLE**: las herramientas operativas soportadas no permiten inducir el caso.
- **AUTOMATIZADO**: existe cobertura local, pero no se alteró el bridge real para simularlo.
- **PENDIENTE**: requiere otro dispositivo.

## Preparación y conectividad

| Caso | Resultado | Observación anonimizada |
|---|---|---|
| Tailscale conectado en teléfono y computadora | APROBADO | Conectividad comprobada con ambos bridges. |
| API privada y rutas explícitas de Tailscale Serve | APROBADO | Solo se usaron los endpoints previstos. |
| Token `snapshot:read` vigente | APROBADO | Se usaron tokens independientes por bridge. |
| PWA instalada desde producción | APROBADO | Versión y commit visibles en Ajustes. |
| Safari → Tailscale → bridge | APROBADO | Verificado con peticiones reales desde el iPhone. |

## Perfil e identidad

| Caso | Resultado | Observación anonimizada |
|---|---|---|
| Crear perfil con alias, URL HTTPS y token | APROBADO | Comprobado con macOS, Windows y perfiles temporales. |
| Token enmascarado y revelado temporalmente | APROBADO | Sin exposición en el reporte. |
| Pegado desde gestor de contraseñas | APROBADO | El token se guardó y utilizó correctamente. |
| Rechazar HTTP | APROBADO | No se creó el perfil inválido. |
| Rechazar loopback | APROBADO | No se creó el perfil inválido. |
| Rechazar path | APROBADO | No se creó el perfil inválido. |
| Rechazar query | APROBADO | No se creó el perfil inválido. |
| Rechazar puerto directo `8766` | APROBADO | Se exigió Tailscale Serve. |
| Mostrar identidad antes de vincular | APROBADO | Se mostró antes de la confirmación. |
| Cancelar primera vinculación | APROBADO | El perfil permaneció sin verificar. |
| Confirmar y persistir identidad | APROBADO | Persistió después de reiniciar la PWA. |
| Editar alias | APROBADO | El cambio se reflejó sin afectar otros perfiles. |
| Reemplazar URL o token exige verificar | APROBADO | La UI solicitó nueva verificación operativa. |
| Persistencia del perfil activo | APROBADO | Comprobada con Mac y Windows. |

## Caja y sincronización

| Caso | Resultado | Observación anonimizada |
|---|---|---|
| Sin perfiles muestra acceso a Ajustes | PENDIENTE | Se reservará para una instalación Android nueva. |
| Perfil sin verificar no permite sincronizar | APROBADO | El botón quedó bloqueado. Existe una incidencia visual menor. |
| Sin snapshot muestra estado vacío | NO COMPROBABLE | No se eliminó información real para recrear el estado. |
| Consultar identidad y último snapshot manualmente | APROBADO | Se observaron exactamente dos GET por sincronización. |
| Total coincide con Excel | APROBADO | Comprobado en macOS y Windows. |
| Seis denominaciones, orden y subtotales | APROBADO | Comprobado en macOS y Windows. |
| Negativos exactos y advertencia textual | APROBADO | El valor se conservó sin normalización. |
| Timestamps generado, recibido y sincronizado | APROBADO | Los tres fueron visibles. |
| Botón bloqueado durante sincronización | APROBADO | Volvió a habilitarse al terminar. |
| Ausencia de polling | APROBADO | No aparecieron peticiones nuevas después de 30 segundos. |
| Persistencia del snapshot al cerrar y abrir | APROBADO | Comprobada online y offline. |

## Fallos y offline

En todos los fallos físicos ejecutados, el snapshot anterior permaneció visible y no se
produjeron excepciones sin manejar ni pantallas rotas.

| Caso | Resultado | Observación anonimizada |
|---|---|---|
| Bridge macOS apagado | APROBADO | Error controlado, conservación y recuperación correctas. |
| Bridge Windows apagado | APROBADO | El perfil Mac permaneció intacto y funcional. |
| Tailscale apagado | APROBADO | Error controlado y recuperación al reconectar. |
| Teléfono sin conexión | APROBADO | La PWA y el snapshot abrieron offline. |
| Token inválido | APROBADO | Mensaje específico y snapshot conservado. |
| Token revocado | APROBADO | Mensaje específico y snapshot conservado. |
| Scope insuficiente | NO EJECUTABLE | El CLI soportado solo permite `snapshot:read`. |
| Snapshot no encontrado | NO COMPROBABLE | Windows ya había publicado antes de la primera sincronización. |
| Respuesta o versión incompatible | AUTOMATIZADO | No existe un mecanismo operativo seguro para inducirla. |
| Cambiar perfil durante una petición | APROBADO | La petición se canceló o su resultado fue ignorado. |
| Desmontar Caja durante una petición | APROBADO | No hubo errores ni mensajes tardíos. |

## Identidad incompatible y re-vinculación

| Caso | Resultado | Observación anonimizada |
|---|---|---|
| Detectar `SOURCE_MISMATCH` | APROBADO | Se usaron temporalmente dos identidades autorizadas. |
| Conservar snapshot anterior durante mismatch | APROBADO | No se guardaron datos de la identidad nueva. |
| Cancelar re-vinculación | APROBADO | Identidad y snapshot permanecieron sin cambios. |
| Mostrar confirmación destructiva | APROBADO | La advertencia mencionó la eliminación del snapshot. |
| Confirmar re-vinculación Mac → Windows y regreso | APROBADO | Se probaron ambas direcciones. |
| Eliminar snapshot de identidad anterior | APROBADO | El dato anterior dejó de aparecer. |
| Activar perfil y sincronizar identidad nueva | APROBADO | La sincronización automática terminó correctamente. |
| Restaurar credenciales e identidad originales | APROBADO | El perfil Windows volvió a su estado esperado. |

## Dos perfiles y eliminación

| Caso | Resultado | Observación anonimizada |
|---|---|---|
| Registrar Mac y Windows | APROBADO | Ambos perfiles se verificaron independientemente. |
| Sincronizar y comparar ambos Excel | APROBADO | Totales, denominaciones y timestamps coincidieron. |
| Cambiar perfil activo varias veces | APROBADO | No se mezclaron snapshots ni identidades. |
| Apagar un bridge sin afectar el otro | APROBADO | El fallo permaneció aislado por perfil. |
| Eliminar perfil inactivo | APROBADO | El perfil activo y su snapshot permanecieron. |
| Eliminar perfil activo | APROBADO | Se utilizó un tercer perfil temporal autorizado. |
| Limpiar selección activa al eliminar | APROBADO | No se seleccionó otro perfil automáticamente. |
| Eliminar snapshot del perfil borrado | APROBADO | El snapshot temporal dejó de aparecer. |

## Instalación, almacenamiento y actualización

| Caso | Resultado | Observación anonimizada |
|---|---|---|
| Instalación en pantalla de inicio | APROBADO | Ajustes reconoció la PWA instalada. |
| Safe areas en vertical y horizontal | APROBADO | Sin controles recortados u ocultos. |
| Viewport sin desplazamiento horizontal global | APROBADO | Navegación y formularios accesibles. |
| Teclado sin zoom automático | APROBADO | Campos y botones continuaron accesibles. |
| IndexedDB después de cerrar y abrir | APROBADO | Perfiles, token y snapshots persistieron. |
| Advertencia de almacenamiento persistente | APROBADO | Visible; la aplicación continuó funcionando. |
| Actualización conserva datos v1/v2 | APROBADO | Configuración, movimientos y perfiles permanecieron. |
| Build nuevo activo | APROBADO | Versión `0.3.0` y commit de producción visibles. |
| Service worker no cachea la API | APROBADO | Las peticiones llegaron a red y el fallo offline no devolvió API cacheada. |

## Matriz final

| Cliente | Bridge | Perfil | Sync | Offline | Identidad | Dos perfiles | Resultado |
|---|---|---|---|---|---|---|---|
| iPhone / Safari PWA | macOS | APROBADO | APROBADO | APROBADO | APROBADO | APROBADO | APROBADO |
| iPhone / Safari PWA | Windows 11 | APROBADO | APROBADO | APROBADO | APROBADO | APROBADO | APROBADO |
| Android / Chrome PWA | macOS o Windows 11 | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |

## Incidencias

### Corregida en código — validación manual puntual pendiente

```text
Plataforma: iPhone / Safari PWA 0.3.0
Caso: cambiar de un perfil verificado a otro sin verificar
Resultado funcional: la sincronización permanece bloqueada
Incidencia original: Caja mostraba “Listo para sincronizar” en estado idle
Datos afectados: no
Severidad: menor, visual
Corrección: mostrar “Perfil pendiente de verificación” cuando no existe sourceId o la
configuración cambió después de la última verificación
Acción siguiente: desplegar y repetir el caso puntual en iPhone
```

La edición distingue datos locales y conexión: cambiar únicamente el alias actualiza
`updatedAt` y `lastVerifiedAt` al mismo valor; cambiar URL o token conserva
`lastVerifiedAt` y deja el perfil pendiente. Si alias y conexión cambian juntos, prevalece
la invalidación.

Validaciones automáticas de la corrección:

```text
npm test: 166/166
npm run lint: aprobado
npm run build: aprobado
git diff --check: aprobado
Validación manual puntual: pendiente de despliegue
```

### Resuelta durante la ejecución — receptor de `fetch` en WebKit

Safari rechazaba `fetch` cuando el cliente lo ejecutaba con una instancia de
`BridgeClient` como receptor. Se cambió la llamada a `fetchImplementation.call(globalThis,
...)`, se añadió una prueba de regresión específica y se desplegó el build corregido. La
verificación y sincronización reales funcionaron después de actualizar la PWA.

Validaciones locales del cambio:

```text
npm test: 156/156
npm run lint: aprobado
npm run build: aprobado
git diff --check: aprobado
```

## Pendientes

1. Desplegar y volver a comprobar el mensaje visual del perfil sin verificar.
2. Ejecutar la fila Android / Chrome PWA cuando exista un dispositivo disponible.
3. Comprobar el estado inicial sin perfiles en la instalación Android nueva.
4. Evaluar un mecanismo de pruebas aislado para `SNAPSHOT_NOT_FOUND`,
   `INSUFFICIENT_SCOPE` y contratos incompatibles, sin modificar datos operativos.

## Conclusión

La Fase 3 queda **aprobada en iPhone contra bridges macOS y Windows 11**, incluidos offline,
errores de autenticación, concurrencia, dos perfiles, aislamiento, re-vinculación,
eliminación transaccional, instalación y actualización. La aprobación multiplataforma
permanece pendiente por la fila Android / Chrome PWA. La corrección visual menor está
implementada y requiere únicamente la revalidación manual puntual después del despliegue.
