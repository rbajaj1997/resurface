import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, transformWithEsbuild, type Plugin } from 'vite'
import { SNAPSHOT_KIND, SNAPSHOT_VERSION } from './src/snapshot'

function bookmarklet(): Plugin {
  const id = 'virtual:bookmarklet'
  const file = fileURLToPath(new URL('./bookmarklet/export.js', import.meta.url))
  return {
    name: 'resurface-bookmarklet',
    resolveId: (source) => (source === id ? `\0${id}` : undefined),
    async load(resolved) {
      if (resolved !== `\0${id}`) return
      this.addWatchFile(file)
      const { code } = await transformWithEsbuild(await readFile(file, 'utf8'), file, {
        minify: true,
        legalComments: 'none',
        define: { SNAPSHOT_KIND: JSON.stringify(SNAPSHOT_KIND), SNAPSHOT_VERSION: String(SNAPSHOT_VERSION) },
      })
      return `export default ${JSON.stringify(`javascript:${encodeURIComponent(code.trim())}`)}`
    },
  }
}

export default defineConfig({
  base: '/resurface/',
  plugins: [react(), bookmarklet()],
})
