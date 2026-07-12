import {
  appInfo,
  formatBuildDate,
  type AppInfo,
} from '../config/appInfo'

type AppInfoSectionProps = {
  info?: AppInfo
}

export function AppInfoSection({ info = appInfo }: AppInfoSectionProps) {
  return (
    <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
      <h3 className="font-semibold text-slate-950">
        Información de la aplicación
      </h3>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="font-medium text-slate-700">Versión</dt>
        <dd className="text-slate-600">{info.version}</dd>
        <dt className="font-medium text-slate-700">Build</dt>
        <dd className="text-slate-600">
          <time dateTime={info.buildDate}>
            {formatBuildDate(info.buildDate)}
          </time>
        </dd>
        <dt className="font-medium text-slate-700">Commit</dt>
        <dd className="font-mono text-slate-600">{info.commitSha}</dd>
      </dl>
    </div>
  )
}
