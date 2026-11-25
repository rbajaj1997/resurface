import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, transformWithEsbuild, type Plugin } from 'vite'
import { HANDOFF_HELLO, HANDOFF_READY, SNAPSHOT_KIND, SNAPSHOT_VERSION } from './src/snapshot'

const site = new URL('https://rbajaj1997.github.io/resurface/')

function bookmarklet(): Plugin {
  const id = 'virtual:bookmarklet'
  const file = fileURLToPath(new URL('./bookmarklet/export.js', import.meta.url))
  let resurfaceOrigin = site.origin
  return {
    name: 'resurface-bookmarklet',
    configResolved(config) {
      if (config.command === 'serve') resurfaceOrigin = `http://localhost:${config.server.port}`
    },
    resolveId: (source) => (source === id ? `\0${id}` : undefined),
    async load(resolved) {
      if (resolved !== `\0${id}`) return
      this.addWatchFile(file)
      const { code } = await transformWithEsbuild(await readFile(file, 'utf8'), file, {
        minify: true,
        legalComments: 'none',
        define: {
          SNAPSHOT_KIND: JSON.stringify(SNAPSHOT_KIND),
          SNAPSHOT_VERSION: String(SNAPSHOT_VERSION),
          HANDOFF_HELLO: JSON.stringify(HANDOFF_HELLO),
          HANDOFF_READY: JSON.stringify(HANDOFF_READY),
          RESURFACE_ORIGIN: JSON.stringify(resurfaceOrigin),
        },
      })
      return `export default ${JSON.stringify(`javascript:${encodeURIComponent(code.trim())}`)}`
    },
  }
}

export default defineConfig({
  base: site.pathname,
  plugins: [react(), bookmarklet()],
})
