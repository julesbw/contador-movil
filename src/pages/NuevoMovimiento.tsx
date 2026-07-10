import type { Movimiento } from '../models/Movimiento'
import { MovimientoForm } from '../components/MovimientoForm'

type NuevoMovimientoProps = {
  onGuardado: (movimiento: Movimiento) => void
}

export function NuevoMovimiento({ onGuardado }: NuevoMovimientoProps) {
  return (
    <section>
      <h2 className="text-2xl font-bold text-slate-950">Nuevo movimiento</h2>
      <p className="mt-1 text-sm text-slate-600">
        Registra una salida para conservarla en este dispositivo.
      </p>
      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
        <MovimientoForm onGuardado={onGuardado} />
      </div>
    </section>
  )
}
