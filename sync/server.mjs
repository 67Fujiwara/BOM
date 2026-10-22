// 共有ストア（1案件1ストア、3者同時参照）の最小サーバ。依存なし。
//   node sync/server.mjs [port] [dataDir]
//   クライアント: VITE_SYNC_URL=http://localhost:8787 npm run dev
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const port = Number(process.argv[2] ?? process.env.PORT ?? 8787)
const dir = process.argv[3] ?? path.join(process.cwd(), 'sync', 'data')
fs.mkdirSync(dir, { recursive: true })
const file = path.join(dir, 'workspace.json')
const logFile = path.join(dir, 'events.log')
let stamp = fs.existsSync(file) ? String(fs.statSync(file).mtimeMs) : ''

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type,x-user', 'access-control-allow-methods': 'GET,PUT,OPTIONS', 'access-control-expose-headers': 'x-stamp' }

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
    if (req.method === 'OPTIONS') return res.writeHead(204, cors).end()
    if (url.pathname === '/api/workspace' && req.method === 'GET') {
      if (!fs.existsSync(file)) return res.writeHead(204, cors).end()
      if (url.searchParams.get('stamp') === stamp) return res.writeHead(204, cors).end()
      res.writeHead(200, { ...cors, 'content-type': 'application/json', 'x-stamp': stamp })
      return fs.createReadStream(file).pipe(res)
    }
    if (url.pathname === '/api/workspace' && req.method === 'PUT') {
      const chunks = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8')
        try {
          JSON.parse(body)
        } catch {
          return res.writeHead(400, cors).end('invalid json')
        }
        fs.writeFileSync(file, body)
        stamp = String(Date.now())
        fs.appendFileSync(logFile, `${new Date().toISOString()}\t${decodeURIComponent(String(req.headers['x-user'] ?? ''))}\t${body.length}\n`)
        res.writeHead(200, { ...cors, 'x-stamp': stamp }).end('ok')
      })
      return
    }
    res.writeHead(404, cors).end('not found')
  })
  .listen(port, () => console.log(`BOM sync store: http://localhost:${port}  data: ${file}`))
