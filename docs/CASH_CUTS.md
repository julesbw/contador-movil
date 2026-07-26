# Cortes de caja

## Diseño

Un corte (`CashCut`) registra el efectivo físico contado, el fondo que
permanece y el retiro resultante. No es un movimiento.

Uno o varios cortes pendientes de la misma tienda pueden generar un solo
movimiento de entrada. El movimiento conserva localmente:

```ts
source: {
  type: 'cash-cuts'
  cashCutIds: string[]
}
```

`source` no forma parte del contrato de exportación JSON 1.0.

## Efectivo

`DesgloseEfectivo` es la fuente común para movimientos y cortes:

- `b1000`, `b500`, `b200`, `b100`, `b50` y `b20` son cantidades enteras.
- `monedas` es el importe monetario total, con máximo dos decimales.
- Las operaciones con importes convierten primero a centavos enteros.
- El retiro se calcula por denominación: `contado - fondo`.

## Persistencia

Dexie versión 3 conserva los esquemas anteriores y agrega:

```text
cashCuts: &id, date, status, movementId, storeId, createdAt
```

La consolidación se ejecuta en una transacción sobre `movimientos` y
`cashCuts`. Dentro de ella se vuelven a leer los cortes y se validan:

- IDs únicos y existentes;
- estado `pending` y ausencia de `movementId`;
- versión optimista `updatedAt`;
- misma identidad de tienda;
- integridad de contado, fondo y retiro por denominación y centavos;
- monto, desglose, fuente y campos fijos del movimiento.

Solo después se agrega el movimiento y se marcan los cortes como
`included`.

La eliminación de una entrada pendiente generada desde cortes también es
atómica: valida la relación bidireccional, restaura los cortes a
`pending` y elimina el movimiento. Un movimiento confirmado como
`exportado` sigue siendo inmutable y no puede revertirse.

Preparar o descargar un lote no cambia estados. Al confirmar, se
comparan dentro de otra transacción los snapshots locales
`{ id, actualizadoEn }` con la versión descargada. Si un movimiento fue
editado o eliminado, no se confirma ninguna parte del lote. Estos
snapshots no forman parte del archivo JSON 1.0.

## Prueba manual principal

1. Abrir **Cortes** y elegir **Nuevo corte**.
2. Registrar ocho billetes de $1,000 y uno de $500: total $8,500.
3. Continuar y dejar como fondo un billete de $1,000 y uno de $500:
   total $1,500.
4. Verificar retiro de siete billetes de $1,000: total $7,000.
5. Guardar y comprobar que el corte aparece como **Pendiente**.
6. Crear otro corte para la misma tienda.
7. Seleccionar ambos y elegir **Crear entrada**.
8. Verificar concepto, fecha, total y desglose consolidados.
9. Confirmar y comprobar que ambos cortes aparecen como **Incluidos**.
10. Usar **Ver movimiento** y comprobar la leyenda de cortes de origen.
11. Editar el movimiento: solo fecha, concepto y notas deben ser
    modificables.
12. Descargarlo desde **Exportar** sin confirmar la exportación.
13. Eliminar el movimiento y aceptar la advertencia; comprobar que ambos
    cortes vuelven a **Pendientes**.
14. Repetir la consolidación, descargar y confirmar la exportación.
15. Comprobar que el movimiento exportado ya no ofrece edición ni
    eliminación.

Comprobaciones adicionales:

- no se pueden seleccionar cortes de tiendas distintas;
- un fondo no puede superar lo contado en ninguna denominación;
- dos pulsaciones de consolidación no generan dos movimientos;
- un error de IndexedDB conserva el formulario visible;
- revisar la interfaz en anchos de 320, 375 y 430 px.
