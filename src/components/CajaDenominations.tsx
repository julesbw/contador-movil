import type { StoredCajaSnapshot } from '../models/CajaSnapshot'

const DENOMINACIONES = [
  { key: '1000', label: '$1,000', value: 1000 },
  { key: '500', label: '$500', value: 500 },
  { key: '200', label: '$200', value: 200 },
  { key: '100', label: '$100', value: 100 },
  { key: '50', label: '$50', value: 50 },
  { key: '20', label: '$20', value: 20 },
] as const satisfies ReadonlyArray<{
  key: keyof StoredCajaSnapshot['billetes']
  label: string
  value: number
}>

const formatoCantidad = new Intl.NumberFormat('es-MX', {
  maximumFractionDigits: 0,
})

const formatoMoneda = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
})

type CajaDenominationsProps = {
  billetes: StoredCajaSnapshot['billetes']
}

export function CajaDenominations({ billetes }: CajaDenominationsProps) {
  const contieneNegativos = DENOMINACIONES.some(
    ({ key }) => billetes[key] < 0,
  )

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
      <h3 className="text-lg font-semibold text-slate-950">Denominaciones</h3>

      {contieneNegativos && (
        <p
          className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
          role="alert"
        >
          Este snapshot contiene cantidades negativas. Los valores se muestran
          exactamente como fueron recibidos desde Excel.
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Cantidad y subtotal por denominación
          </caption>
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-3 pr-4 font-medium" scope="col">
                Denominación
              </th>
              <th className="px-4 py-3 text-right font-medium" scope="col">
                Cantidad
              </th>
              <th className="py-3 pl-4 text-right font-medium" scope="col">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {DENOMINACIONES.map(({ key, label, value }) => {
              const cantidad = billetes[key]
              const esNegativa = cantidad < 0

              return (
                <tr key={key}>
                  <th
                    className="py-3 pr-4 text-left font-medium text-slate-700"
                    scope="row"
                  >
                    {label}
                  </th>
                  <td
                    className={`px-4 py-3 text-right font-semibold tabular-nums ${
                      esNegativa ? 'text-red-700' : 'text-slate-800'
                    }`}
                  >
                    {formatoCantidad.format(cantidad)}
                  </td>
                  <td
                    className={`py-3 pl-4 text-right font-semibold tabular-nums ${
                      esNegativa ? 'text-red-700' : 'text-slate-950'
                    }`}
                  >
                    {formatoMoneda.format(cantidad * value)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
