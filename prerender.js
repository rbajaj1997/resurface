import { readFile, writeFile } from 'node:fs/promises'
import { render } from './dist/server/server.js'

const page = new URL('./dist/client/index.html', import.meta.url)
const emptyAppRoot = '<div id="root"></div>'
const html = await readFile(page, 'utf8')
if (html.split(emptyAppRoot).length !== 2) throw new Error(`Expected exactly one empty app root in ${page.pathname}`)
await writeFile(page, html.replace(emptyAppRoot, () => `<div id="root">${render()}</div>`))
