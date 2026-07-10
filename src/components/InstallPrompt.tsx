import type { InstalacionPwa } from '../hooks/usePwaInstall'

type InstallPromptProps = {
  instalacion: InstalacionPwa
}

export function InstallPrompt({ instalacion }: InstallPromptProps) {
  if (instalacion.estado !== 'disponible') {
    return null
  }

  return (
    <aside className="border-b border-teal-200 bg-teal-50">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="font-semibold text-teal-950">
            Instala Contador Móvil
          </p>
          <p className="text-sm text-teal-800">
            Accede más rápido y reduce el riesgo de perder datos locales.
          </p>
        </div>
        <button
          className="button-primary shrink-0"
          type="button"
          onClick={() => void instalacion.instalar()}
        >
          Instalar aplicación
        </button>
      </div>
    </aside>
  )
}
