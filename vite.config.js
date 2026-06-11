import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only: run the Vercel-style /api/*.js functions under `vite dev`.
// Vite doesn't execute serverless functions, so this middleware loads the
// matching handler from /api and adapts the Node req/res to the same shape
// Vercel provides (req.body parsed as JSON, res.status().json()). In
// production, Vercel runs /api/*.js directly and this plugin isn't used.
function devApi(mode) {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      // Vite only exposes VITE_-prefixed vars to the client; server-side
      // functions need the unprefixed keys (e.g. ANTHROPIC_API_KEY) in
      // process.env. loadEnv('', cwd, '') reads ALL keys from .env regardless
      // of prefix — inject any that aren't already set. Dev parity with Vercel.
      const fileEnv = loadEnv(mode, process.cwd(), '')
      for (const [k, v] of Object.entries(fileEnv)) {
        if (process.env[k] === undefined) process.env[k] = v
      }
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next()
        const route = req.url.split('?')[0].replace(/\/$/, '')
        const name = route.slice('/api/'.length)
        if (!/^[a-z0-9-]+$/i.test(name)) return next()

        try {
          // Read + JSON-parse the body (Vercel does this for us in prod).
          const chunks = []
          for await (const c of req) chunks.push(c)
          const raw = Buffer.concat(chunks).toString('utf8')
          req.body = raw ? JSON.parse(raw) : {}

          // Add the Vercel-style res helpers.
          res.status = (code) => { res.statusCode = code; return res }
          res.json = (obj) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(obj))
            return res
          }

          const mod = await server.ssrLoadModule(`/api/${name}.js`)
          await mod.default(req, res)
        } catch (err) {
          if (err?.code === 'ERR_LOAD_URL' || /Cannot find module/.test(err?.message || '')) {
            return next() // no such function → fall through to SPA
          }
          console.error('[dev-api] error:', err)
          if (!res.writableEnded) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Dev API error.' }))
          }
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), devApi(mode)],
}))
