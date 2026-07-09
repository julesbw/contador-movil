# Contador Mobile PWA - Especificación MVP v0.2

> Cambios respecto a v0.1: se agrega tabla de configuración, persistencia de storage, validación de cuadre de efectivo, se aclara que "Exportar todo" no modifica estados, se generaliza `tipo` a `entrada`/`salida`, se anota el requisito de ajustes para el futuro importador, y se cierran los detalles menores (zona horaria, catálogo de categorías, paginación).

## Objetivo

Desarrollar una **Progressive Web App (PWA)** para registrar movimientos del contador desde un teléfono móvil, funcionando **offline** y sin depender de un servidor.

El objetivo del MVP es permitir registrar movimientos en el momento en que ocurren, almacenarlos localmente y posteriormente exportarlos en formato JSON para ser importados por el sistema Contador.

---

# Filosofía del proyecto

El sistema debe ser **offline-first**.

Toda la información se almacena localmente en el dispositivo.

No existirá autenticación.

No existirá backend.

No existirá sincronización automática.

La aplicación debe seguir funcionando aunque no exista conexión a Internet.

---

# Stack tecnológico

## Frontend

- React
- TypeScript
- Vite

## Estilos

- Tailwind CSS

## Base de datos local

- IndexedDB

## Capa de acceso a datos

- Dexie.js

## Tipo de aplicación

- Progressive Web App (PWA)

---

# Objetivos del MVP

El MVP debe permitir:

- Registrar un movimiento (salida; entrada queda en el esquema pero bloqueada en UI, ver sección "Tipo de movimiento").
- Guardar el movimiento localmente.
- Visualizar todos los movimientos registrados.
- Editar movimientos pendientes de exportación.
- Eliminar movimientos pendientes de exportación.
- Exportar movimientos a un archivo JSON.
- Exportar únicamente movimientos pendientes.
- Exportar todos los movimientos como respaldo (sin alterar su estado).
- Marcar manualmente un lote como exportado.
- Persistir la configuración local del dispositivo (`dispositivo_id`, `capturado_por`).
- Solicitar almacenamiento persistente al navegador para reducir el riesgo de pérdida de datos.

---

# Funcionalidades fuera del MVP

No implementar:

- Usuarios.
- Login.
- Backend.
- API.
- Sincronización.
- PostgreSQL.
- FastAPI.
- Dashboard.
- Reportes.
- Captura de movimientos tipo "entrada" desde la UI (el esquema ya lo soporta, ver más abajo).
- Movimientos de ajuste sobre exportados ya confirmados (anotado como requisito futuro, ver sección "Reglas para el futuro importador del Contador").
- Importación de JSON (eso será responsabilidad del sistema Contador).

---

# Arquitectura

```
React

↓

Lógica de negocio

↓

Repositorio de datos

↓

Dexie.js

↓

IndexedDB
```

La aplicación deberá desacoplar la lógica de negocio de Dexie mediante repositorios para facilitar futuras migraciones a un backend.

---

# Persistencia de almacenamiento

Al arrancar la aplicación por primera vez, se debe solicitar almacenamiento persistente al navegador para reducir (no elimina por completo) el riesgo de que IndexedDB sea purgado automáticamente por presión de espacio:

```ts
async function ensurePersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persisted();
    if (!isPersisted) {
      await navigator.storage.persist();
    }
  }
}
```

Esta función se ejecuta una sola vez al iniciar `App.tsx`.

Adicionalmente, la UI debe sugerir al usuario instalar la PWA a la pantalla de inicio (prompt de instalación estándar), ya que el modo "instalado" tiene menor probabilidad de eviction que una pestaña de navegador suelta.

---

# Modelo de datos

## Tipo de movimiento

El esquema diferencia entre **entrada** y **salida**, aunque en este MVP la UI solo permite capturar movimientos de tipo `"salida"`. Se deja el tipo abierto desde ahora para evitar una migración de esquema en Dexie más adelante.

```ts
type TipoMovimiento = "entrada" | "salida";
```

## Movimiento

```ts
type Movimiento = {
  id: string;

  tipo: TipoMovimiento;

  fechaMovimiento: string;

  monto: number;

  concepto: string;

  categoria: Categoria;

  formaPago: "efectivo" | "tarjeta" | "transferencia" | "otro";

  billetes: {
    b1000: number;
    b500: number;
    b200: number;
    b100: number;
    b50: number;
    b20: number;
    monedas: number;
  };

  notas?: string;

  estadoExportacion: "pendiente" | "exportado";

  exportadoEn?: string;

  loteExportacionId?: string;

  creadoEn: string;

  actualizadoEn: string;
};
```

## Configuración del dispositivo

Nueva tabla para persistir datos de contexto del dispositivo, requeridos por el JSON de exportación (`dispositivo_id`, `capturado_por`), que en v0.1 no tenían dónde vivir.

```ts
type ConfigItem = {
  key: string; // "dispositivo_id" | "capturado_por"
  value: string;
};
```

Reglas:

- `dispositivo_id` se genera una sola vez con `crypto.randomUUID()` en el primer arranque de la app y nunca se vuelve a regenerar.
- `capturado_por` es editable manualmente desde una pantalla de Ajustes (texto libre, puede quedar vacío).
- Esta tabla vive en Dexie junto con `movimientos`, como una tabla key-value simple.

---

# Categorías

Las categorías serán un catálogo fijo, definido como constante tipada (no enum de TypeScript, para poder iterarlo fácilmente en selects de UI):

```ts
const CATEGORIAS = [
  "Transporte",
  "Comida",
  "Compras",
  "Sueldos",
  "Mantenimiento",
  "Servicios",
  "Otros",
] as const;

type Categoria = (typeof CATEGORIAS)[number];
```

No permitir texto libre para categorías.

---

# Denominaciones de efectivo

```text
1000
500
200
100
50
20
Monedas
```

Las monedas se almacenarán como un único valor agregado.

---

# Base de datos

## Tablas

```
movimientos
config
```

## Índices — movimientos

```
&id
fechaMovimiento
tipo
categoria
estadoExportacion
loteExportacionId
creadoEn
```

## Índices — config

```
&key
```

---

# Reglas de negocio

## Validaciones

- monto > 0
- concepto obligatorio
- categoría obligatoria
- fecha obligatoria
- forma de pago obligatoria

Si la forma de pago es distinta de efectivo, los campos de billetes podrán quedar en cero.

## Validación de cuadre de efectivo

Cuando `formaPago === "efectivo"`, la suma de las denominaciones debe coincidir con `monto`:

```ts
function calcularTotalBilletes(billetes: Movimiento["billetes"]): number {
  return (
    billetes.b1000 * 1000 +
    billetes.b500 * 500 +
    billetes.b200 * 200 +
    billetes.b100 * 100 +
    billetes.b50 * 50 +
    billetes.b20 * 20 +
    billetes.monedas
  );
}
```

Si `calcularTotalBilletes(billetes) !== monto`, la app **no bloquea el guardado**, pero muestra una advertencia visible antes de confirmar (ej. "El desglose de efectivo no cuadra con el monto capturado, ¿deseas continuar?"). Es una advertencia (soft warning), no un error bloqueante, ya que puede haber casos legítimos de forma de pago mixta fuera del alcance del MVP.

---

# Exportación

Existirán dos opciones:

## Exportar pendientes

Exporta únicamente movimientos con:

```
estadoExportacion = "pendiente"
```

Este flujo, tras confirmación del usuario, **sí** marca los movimientos incluidos como `"exportado"`.

## Exportar todo

Genera un respaldo completo de todos los movimientos (pendientes + ya exportados).

Este flujo es únicamente un respaldo: **no modifica `estadoExportacion` de ningún movimiento**, sin importar su estado actual. No dispara el flujo de confirmación/marcado descrito abajo.

---

# Flujo de exportación

Aplica solo a "Exportar pendientes". "Exportar todo" es una descarga directa sin este flujo (ver sección anterior).

```
Seleccionar movimientos pendientes

↓

Generar JSON

↓

Guardar o compartir archivo

↓

Confirmar exportación

↓

Marcar movimientos como exportados
```

NO marcar automáticamente como exportado antes de la confirmación explícita del usuario.

---

# Movimientos exportados

Los movimientos exportados:

- No podrán editarse.
- No podrán eliminarse.

Las correcciones mediante movimientos de ajuste quedan fuera del MVP (ver anotación en "Reglas para el futuro importador del Contador").

---

# JSON de exportación

```json
{
  "version": "1.0",
  "origen": "contador_mobile_pwa",
  "tipo_exportacion": "movimientos",
  "lote_exportacion_id": "",
  "fecha_exportacion": "",
  "zona_horaria": "America/Mexico_City",
  "dispositivo_id": "",
  "capturado_por": "",
  "total_movimientos": 0,
  "movimientos": []
}
```

Cada movimiento incluirá:

- id
- tipo
- fecha_movimiento
- monto
- concepto
- categoria
- forma_pago
- billetes
- notas
- creado_en
- actualizado_en

`dispositivo_id` y `capturado_por` se leen de la tabla `config` al momento de generar el JSON.

`zona_horaria` se calcula dinámicamente con `Intl.DateTimeFormat().resolvedOptions().timeZone` en lugar de quedar hardcodeada, para que el valor por default sea correcto si la app llegara a correr fuera de `America/Mexico_City` sin requerir un cambio de código.

---

# IDs

Todos los movimientos utilizarán UUID.

Nunca utilizar IDs incrementales.

---

# Compatibilidad futura

La estructura del JSON deberá mantenerse estable para que posteriormente pueda ser consumida por una API FastAPI sin modificar el modelo de datos.

---

# Reglas para el futuro importador del Contador

Aunque no forma parte de este proyecto, el sistema Contador deberá cumplir las siguientes reglas:

- No importar dos veces el mismo ID.
- Validar la versión del archivo.
- Validar el origen del archivo.
- Procesar únicamente movimientos válidos.
- **[Anotado para diseño futuro]** Soportar movimientos de ajuste que referencien el `id` de un movimiento ya exportado/importado, ya que la PWA no permite editar ni eliminar movimientos exportados. El mecanismo de ajuste (nuevo movimiento compensatorio vs. corrección directa) queda pendiente de definir cuando se diseñe esa pieza, pero debe contemplarse desde ahora en el modelo de datos del Contador para no requerir una migración posterior.

---

# Paginación de la lista de movimientos

La pantalla "Movimientos" no debe cargar la tabla completa con un `toArray()` sin límite. Usar paginación o scroll incremental desde el inicio, aprovechando el soporte nativo de Dexie:

```ts
db.movimientos
  .orderBy("fechaMovimiento")
  .reverse()
  .offset(pagina * tamanoPagina)
  .limit(tamanoPagina)
  .toArray();
```

No es crítico para el volumen esperado en Sprint 1, pero se define desde ahora para no tener que reescribir el query de la lista más adelante.

---

# Estructura sugerida del proyecto

```
contador-mobile-pwa/

src/
│
├── db/
│   ├── db.ts
│   ├── movimientosRepo.ts
│   ├── configRepo.ts
│
├── models/
│   ├── Movimiento.ts
│   └── Categoria.ts
│
├── services/
│   ├── exportService.ts
│   ├── movimientoService.ts
│   └── storagePersistService.ts
│
├── pages/
│   ├── NuevoMovimiento.tsx
│   ├── Movimientos.tsx
│   ├── Exportar.tsx
│   ├── Ajustes.tsx
│
├── components/
│
├── hooks/
│
├── utils/
│
└── App.tsx
```

---

# Sprint 1

Objetivo: lograr un MVP funcional que permita registrar y exportar movimientos.

## Tareas

- Crear el proyecto con React + Vite + TypeScript.
- Configurar Tailwind CSS.
- Configurar PWA.
- Configurar Dexie.js e IndexedDB.
- Definir el esquema de la base de datos (`movimientos` y `config`).
- Crear el modelo `Movimiento` y el tipo `TipoMovimiento`.
- Implementar el repositorio de movimientos.
- Implementar el repositorio de configuración (`dispositivo_id`, `capturado_por`).
- Implementar la solicitud de almacenamiento persistente (`navigator.storage.persist()`) al arranque.
- Implementar el prompt de instalación de la PWA.
- Crear la pantalla "Nuevo movimiento" (tipo `"salida"` fijo en UI).
- Crear la pantalla "Lista de movimientos" con paginación.
- Implementar edición y eliminación de movimientos pendientes.
- Implementar la validación de cuadre entre `monto` y `billetes` (advertencia no bloqueante).
- Crear la pantalla "Ajustes" para editar `capturado_por`.
- Implementar la generación del archivo JSON para "Exportar pendientes" y "Exportar todo" (esta última sin tocar `estadoExportacion`).
- Implementar el flujo de confirmación para marcar movimientos como exportados (solo aplica a "Exportar pendientes").

## Criterio de aceptación

Al finalizar el Sprint 1 debe ser posible:

1. Registrar un movimiento de salida desde un teléfono.
2. Consultar los movimientos registrados, con la lista paginada.
3. Editar o eliminar movimientos pendientes.
4. Recibir una advertencia si el desglose de efectivo no cuadra con el monto, sin que esto bloquee el guardado.
5. Exportar un archivo JSON válido de movimientos pendientes, y confirmar/marcar como exportados.
6. Exportar un respaldo completo sin que cambie el estado de ningún movimiento.
7. Configurar `capturado_por` desde Ajustes y ver que se refleje en el JSON exportado.
8. Abrir nuevamente la aplicación y conservar todos los datos gracias a IndexedDB, incluso tras cerrar y reabrir el navegador.
