export const appInfo = {
  version: __APP_VERSION__,
  buildDate: __BUILD_DATE__,
  commitSha: __COMMIT_SHA__,
} as const

export type AppInfo = typeof appInfo

export function formatBuildDate(buildDate: string, locale?: string) {
  const date = new Date(buildDate)

  if (Number.isNaN(date.getTime())) {
    return buildDate
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}
