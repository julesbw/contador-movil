# Versionado de Contador Móvil PWA

La versión de la PWA se mantiene únicamente en `package.json`. Es independiente
de la versión del add-in de Excel y de la versión `1.0` del contrato JSON
exportado.

## Publicar una versión

Trabaja siempre con el repositorio limpio y elige el incremento semántico:

- `npm version patch` para correcciones compatibles, por ejemplo `0.2.1` a
  `0.2.2`.
- `npm version minor` para funcionalidad nueva compatible, por ejemplo `0.2.2`
  a `0.3.0`.
- `npm version major` para la primera versión estable o cambios incompatibles.

`npm version` actualiza `package.json` y `package-lock.json`, crea el commit y la
tag correspondiente (`v0.2.1`). Después publica ambos:

```bash
git push origin main --follow-tags
```

Vercel ejecuta `npm run build` e inyecta automáticamente
`VERCEL_GIT_COMMIT_SHA`. La compilación incorpora la versión, la fecha y los
primeros siete caracteres del commit. En compilaciones locales, el commit se
muestra como `local`.
