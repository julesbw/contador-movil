# Despliegue — Fase 3 Bridge → PWA

## Entorno soportado

`package.json` requiere:

```text
Node ^22.12.0 o >=24.0.0
```

La implementación de Fase 3 se verificó localmente con:

```text
Node 24.15.0
npm 11.12.1
```

No usar Node 23.3.0 para construir esta versión.

## Verificación previa

Desde un worktree limpio:

```bash
npm ci
npm test
npm run lint
npm run build
git diff --check
```

Revisar `dist/` y confirmar:

- `manifest.webmanifest` y assets presentes;
- service worker generado;
- ningún token, URL privada o dato real en el bundle;
- ningún runtime cache de `/api/v1/source` o `/api/v1/snapshots/latest`.

## Producción

El origen autorizado es:

```text
https://contador-movil.vercel.app
```

El bridge conserva una allowlist exacta. Los dominios preview de Vercel no deben habilitarse
con wildcard; un preview no podrá sincronizar salvo que exista una decisión explícita y
temporal de seguridad fuera de este despliegue.

Vercel debe ejecutar la instalación bloqueada y `npm run build`. No se requieren variables de
entorno, secretos ni cambios de backend para Fase 3.

## Dexie v2

La primera apertura crea `bridgeProfiles` y `cajaSnapshots` sin modificar `movimientos` ni
`config`. La migración es local a cada navegador y perfil de instalación.

Antes de promover producción:

1. abrir el build anterior y crear datos v1 de prueba;
2. desplegar el build candidato;
3. abrir la misma instalación;
4. confirmar movimientos/configuración intactos;
5. crear un perfil y snapshot;
6. cerrar y reabrir la PWA;
7. confirmar persistencia v2.

## Service worker y ventanas con versiones distintas

`vite-plugin-pwa` genera y activa actualizaciones automáticamente, pero una pestaña abierta
puede continuar ejecutando el build anterior hasta recargarse. Por eso v2 es aditiva y no
transforma las filas v1.

Después de desplegar:

- cerrar y reabrir la PWA instalada para validar el build activo;
- revisar la versión y commit en Ajustes;
- confirmar que assets funcionan offline;
- confirmar mediante Network que los dos GET autenticados llegan a la red y usan
  `cache: no-store`.

## CSP

La CSP permite recursos de la propia aplicación, estilos inline requeridos por la inyección
de CSS de Vite, conexiones HTTPS a bridges privados y el WebSocket local requerido por HMR.
Antes de promover, probar:

- `npm run dev` en `localhost:5173`;
- build servido localmente;
- despliegue Vercel;
- instalación PWA y actualización;
- conexión HTTPS privada mediante Tailscale Serve.

No ampliar `connect-src` a HTTP ni introducir HTML dinámico para resolver errores de CSP.

## Rollback

Después de que un dispositivo abra Dexie v2, no desplegar un build que conozca únicamente
v1. El rollback seguro es un **roll forward**:

1. conservar las declaraciones de tablas v1 y v2;
2. corregir la aplicación en un build nuevo;
3. desplegarlo como una versión posterior;
4. no eliminar stores ni datos para desactivar temporalmente la UI de Caja.

Si es necesario deshabilitar la sincronización por una incidencia, ocultar o bloquear la
acción en un build compatible con v2; los perfiles y snapshots deben permanecer intactos.

## Validación posterior

Completar `docs/PHASE3_MANUAL_TEST.md` en:

- iPhone con bridge macOS;
- iPhone con bridge Windows 11;
- Android con al menos uno de los bridges;
- escenario de dos perfiles.

Registrar solo resultados anonimizados. No copiar URL, token, hostname, IDs completos ni
datos reales de Caja.
