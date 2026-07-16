# Integración Bridge → PWA

## Alcance

Contador Móvil consulta manualmente el último snapshot de Caja publicado por Excel y lo
conserva en IndexedDB. La PWA es de solo lectura: no envía movimientos, no modifica Excel y
no contiene polling, WebSockets ni sincronización automática.

```text
Excel → Add-in → Bridge → Tailscale Serve
                         ↓ HTTPS + Bearer
                  Contador Móvil
                         ↓
               IndexedDB contador_movil v2
```

## Capas

- `src/models`: perfiles y snapshots separados de `Movimiento`.
- `src/db`: Dexie y repositorios; la UI nunca accede directamente a IndexedDB.
- `src/api`: normalización de URL, validadores runtime y cliente HTTP privado.
- `src/services`: ciclo de vida de perfiles, identidad y sincronización de Caja.
- `src/components` y `src/pages`: administración de perfiles y presentación de solo lectura.

## IndexedDB v2

La base existente conserva el nombre `contador_movil`. La versión 2 mantiene sin
transformaciones las tablas v1:

```text
movimientos
config
```

y agrega:

```text
bridgeProfiles
  &id, sourceId, createdAt, updatedAt

cajaSnapshots
  &profileId, snapshotId, sourceId, generatedAt, syncedAt
```

`profileId` es la clave primaria del snapshot: cada perfil conserva únicamente su último
dato. `token`, `baseUrl`, alias y `sourceName` no se indexan. El perfil activo se guarda en
`config` con la clave `active_bridge_profile_id`.

Las siguientes operaciones son transaccionales:

- eliminar perfil, snapshot y selección activa;
- re-vincular identidad y eliminar el snapshot anterior;
- guardar un snapshot solo si el perfil sigue existiendo, continúa activo, conserva el mismo
  `updatedAt` y tiene la identidad esperada.

## Perfiles e identidad

Cada perfil contiene un UUID local independiente del `sourceId`, un alias, el origen HTTPS,
el token de lectura y la identidad verificada del bridge.

La primera verificación consulta `GET /api/v1/source`, muestra `sourceName` y requiere
confirmación antes de guardar la identidad. Cada sincronización vuelve a consultar `source`
antes de solicitar `latest`.

Si cambia `sourceId`:

1. se bloquea el snapshot nuevo;
2. se conserva el dato anterior;
3. la UI explica el conflicto;
4. una re-vinculación exige confirmación explícita;
5. la transacción elimina el snapshot anterior y guarda la identidad nueva;
6. el perfil queda activo y la misma acción intenta sincronizarlo nuevamente.

Eliminar el perfil activo deja la aplicación sin perfil activo; no se selecciona otro
automáticamente.

## URL privada

La URL se normaliza a un origen y acepta únicamente HTTPS. Se rechazan:

- HTTP y esquemas peligrosos;
- usuario o contraseña embebidos;
- query string y fragmento;
- paths arbitrarios;
- `localhost`, IPv4 `127/8` y loopback IPv6;
- el puerto privado `8766` escrito directamente.

La PWA debe recibir la URL HTTPS expuesta mediante rutas explícitas de Tailscale Serve. El
token se envía solamente en `Authorization`; nunca forma parte de la URL.

## Cliente y contratos

La sincronización usa:

```http
GET /api/v1/source
GET /api/v1/snapshots/latest
Authorization: Bearer <token>
Accept: application/json
```

`credentials` se configura como `omit`, el caché HTTP como `no-store` y el timeout como
5000 ms. Una cancelación del controlador externo se distingue de un timeout.

Las respuestas se leen primero como texto y después se intenta interpretar JSON. Los
validadores manuales exigen objetos cerrados, contrato `1.0`, UUID, timestamps RFC 3339 con
zona, exactamente seis denominaciones, enteros seguros y total recalculado mediante
aritmética exacta. Los negativos se preservan.

## Sincronización

El flujo manual es:

```text
capturar perfil activo y updatedAt
→ validar identidad remota
→ validar último snapshot
→ comparar los tres sourceId
→ confirmar que perfil y selección no cambiaron
→ guardar snapshot completo con syncedAt
```

Solo existe una sincronización activa por instancia. Cambiar perfil o desmontar Caja aborta
la petición; los resultados obsoletos se ignoran. El botón permanece deshabilitado mientras
la operación está activa.

Ante cualquier fallo no se escribe ni se elimina nada. La pantalla conserva el último
snapshot y lo identifica como “Último dato disponible”.

## Errores visibles

La UI distingue autenticación, token revocado, permisos, snapshot ausente, versión no
compatible, respuesta inválida, identidad distinta, timeout, cancelación y error interno.
Un rechazo CORS, Tailscale desconectado y un bridge apagado pueden verse en el navegador
como el mismo fallo de red; el mensaje no afirma una causa que no puede comprobarse.

Nunca se muestra el mensaje remoto bruto ni se registra el token, la URL, el payload o el
envelope recibido.

## Offline y presentación

Los snapshots permanecen en IndexedDB y no se guardan en Cache Storage. El service worker
solo conserva assets y fallback de navegación; no existe runtime caching para endpoints
autenticados.

Caja muestra alias, identidad, total MXN, cantidades y subtotales de las seis
denominaciones, además de `generatedAt`, `receivedAt` y `syncedAt`. Los negativos se muestran
sin normalizar y con advertencia textual. Las inconsistencias temporales también se anuncian
por texto, no solo por color.

La solicitud de almacenamiento persistente continúa siendo best-effort. Si el navegador la
rechaza, Ajustes muestra una advertencia y la aplicación sigue operando.

## Seguridad

- El token queda accesible a JavaScript e IndexedDB por diseño; no se implementa cifrado con
  una clave incluida en la propia PWA.
- Los campos remotos y locales se renderizan con React, sin HTML dinámico.
- La CSP limita scripts, workers y formularios al propio origen. Los estilos permiten inline
  porque Vite los inyecta durante el desarrollo; `connect-src` permite HTTPS para perfiles
  privados y WebSocket local únicamente para HMR de Vite.
- Las respuestas autenticadas no se cachean.
- Los perfiles y tokens no forman parte de las exportaciones de movimientos.
