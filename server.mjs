// 零依赖 Node 服务器：/api 提供书籍与进度接口，其余请求托管 dist/ 静态页面
// 数据保存在 data/ 目录：books.json（书架）、progress.json（进度）、books/*.txt（正文）

import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseChapters } from './src/lib/chapterParser.js'

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.join(ROOT_DIR, 'dist')
const DATA_DIR = path.join(ROOT_DIR, 'data')
const BOOKS_DIR = path.join(DATA_DIR, 'books')
const BOOKS_JSON = path.join(DATA_DIR, 'books.json')
const PROGRESS_JSON = path.join(DATA_DIR, 'progress.json')

const PORT = Number(process.env.PORT || 5174)
const MAX_BOOK_BYTES = 200 * 1024 * 1024 // 上传正文上限 200MB
const MAX_PROGRESS_BYTES = 10 * 1024 * 1024

// ---------- 数据状态 ----------

let books = [] // 书籍 meta 数组
let progress = {} // bookId -> 进度

// JSON 文件写入串行化，避免并发请求交错写坏文件
let writeQueue = Promise.resolve()
function serialize(write) {
  const run = writeQueue.then(write, write)
  writeQueue = run.catch(() => {})
  return run
}

async function saveJson(file, value) {
  const tmp = `${file}.tmp`
  await fs.writeFile(tmp, `${JSON.stringify(value)}\n`)
  await fs.rename(tmp, file)
}

async function pathExists(p) {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

async function loadData() {
  await fs.mkdir(BOOKS_DIR, { recursive: true })
  try {
    const list = JSON.parse(await fs.readFile(BOOKS_JSON, 'utf8'))
    if (Array.isArray(list)) books = list
  } catch {
    // 首次启动或文件损坏，视为空书架
  }
  try {
    const map = JSON.parse(await fs.readFile(PROGRESS_JSON, 'utf8'))
    if (map && typeof map === 'object' && !Array.isArray(map)) progress = map
  } catch {
    // 同上
  }
}

// 与前端原 bookIdFromFile 相同的算法：同名同大小幂等覆盖
function bookIdFromFile(name, size) {
  let hash = 5381
  const key = `${name}::${size}`
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) >>> 0
  }
  return `bk-${hash.toString(36)}`
}

// ---------- HTTP 工具 ----------

function sendJson(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(value))
}

// 流式收集请求体；超限时丢弃数据继续读完，结束后拒绝（保证能正常响应 413）
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let tooLarge = false
    req.on('data', (chunk) => {
      if (tooLarge) return
      size += chunk.length
      if (size > limit) {
        tooLarge = true
        chunks.length = 0
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (tooLarge) reject(new Error('数据超出大小限制'))
      else resolve(Buffer.concat(chunks))
    })
    req.on('error', reject)
  })
}

// ---------- API ----------

async function handleApi(req, res, pathname) {
  if (pathname === '/api/books') {
    if (req.method === 'GET') return sendJson(res, 200, books)
    if (req.method === 'POST') return handleUpload(req, res)
    return sendJson(res, 405, { error: '不支持的请求方法' })
  }

  let match = pathname.match(/^\/api\/books\/([^/]+)\/text$/)
  if (match) {
    if (req.method !== 'GET') return sendJson(res, 405, { error: '不支持的请求方法' })
    return handleGetText(res, match[1])
  }

  match = pathname.match(/^\/api\/books\/([^/]+)$/)
  if (match) {
    if (req.method !== 'DELETE') return sendJson(res, 405, { error: '不支持的请求方法' })
    return handleDelete(res, match[1])
  }

  if (pathname === '/api/progress') {
    if (req.method === 'GET') return sendJson(res, 200, progress)
    if (req.method === 'PUT') return handleSaveProgress(req, res)
    return sendJson(res, 405, { error: '不支持的请求方法' })
  }

  sendJson(res, 404, { error: '接口不存在' })
}

async function handleUpload(req, res) {
  let name = ''
  try {
    name = decodeURIComponent(String(req.headers['x-book-name'] || ''))
  } catch {
    name = ''
  }
  if (!name.trim()) return sendJson(res, 400, { error: '缺少书名' })

  let buffer
  try {
    buffer = await readBody(req, MAX_BOOK_BYTES)
  } catch {
    return sendJson(res, 413, { error: '文件过大（上限 200MB）' })
  }
  const text = buffer.toString('utf8')
  if (!text.trim()) return sendJson(res, 400, { error: '文件内容为空' })

  const id = bookIdFromFile(name, buffer.length)
  let meta
  await serialize(async () => {
    const existing = books.find((b) => b.id === id)
    const chapters = parseChapters(text)
    meta = {
      id,
      name,
      size: buffer.length,
      chapterCount: chapters.length,
      charCount: chapters.reduce((sum, c) => sum + c.charCount, 0),
      addedAt: existing?.addedAt ?? Date.now(),
    }
    await fs.writeFile(path.join(BOOKS_DIR, `${id}.txt`), text)
    books = [meta, ...books.filter((b) => b.id !== id)]
    await saveJson(BOOKS_JSON, books)
  })
  sendJson(res, 200, meta)
}

async function handleGetText(res, id) {
  if (!books.some((b) => b.id === id)) return sendJson(res, 404, { error: '书籍不存在' })
  try {
    const text = await fs.readFile(path.join(BOOKS_DIR, `${id}.txt`), 'utf8')
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(text)
  } catch {
    sendJson(res, 404, { error: '书籍正文缺失' })
  }
}

async function handleDelete(res, id) {
  if (!books.some((b) => b.id === id)) return sendJson(res, 404, { error: '书籍不存在' })
  await serialize(async () => {
    await fs.rm(path.join(BOOKS_DIR, `${id}.txt`), { force: true })
    books = books.filter((b) => b.id !== id)
    if (id in progress) {
      const next = { ...progress }
      delete next[id]
      progress = next
    }
    await saveJson(BOOKS_JSON, books)
    await saveJson(PROGRESS_JSON, progress)
  })
  sendJson(res, 200, { ok: true })
}

async function handleSaveProgress(req, res) {
  let buffer
  try {
    buffer = await readBody(req, MAX_PROGRESS_BYTES)
  } catch {
    return sendJson(res, 413, { error: '进度数据过大' })
  }
  let map
  try {
    map = JSON.parse(buffer.toString('utf8'))
  } catch {
    return sendJson(res, 400, { error: '进度数据格式错误' })
  }
  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    return sendJson(res, 400, { error: '进度数据格式错误' })
  }
  await serialize(async () => {
    progress = map
    await saveJson(PROGRESS_JSON, progress)
  })
  sendJson(res, 200, { ok: true })
}

// ---------- 静态文件 ----------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

async function serveStatic(res, pathname) {
  if (!(await pathExists(DIST_DIR))) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('dist/ 目录不存在，请先运行 npm run build 再启动服务')
    return
  }

  // 路径穿越防护：解析结果必须仍在 dist 内
  const resolved = path.resolve(DIST_DIR, `.${pathname}`)
  if (resolved !== DIST_DIR && !resolved.startsWith(`${DIST_DIR}${path.sep}`)) {
    res.writeHead(403)
    res.end()
    return
  }

  let filePath = resolved
  try {
    const stat = await fs.stat(filePath)
    if (stat.isDirectory()) filePath = path.join(DIST_DIR, 'index.html')
  } catch {
    filePath = path.join(DIST_DIR, 'index.html') // SPA 回落
  }

  try {
    const data = await fs.readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    // Vite 产物中 assets 带内容 hash 可长缓存；其余（index.html 等）每次校验
    const immutable = pathname.startsWith('/assets/')
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': immutable
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    })
    res.end(data)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('404 Not Found')
  }
}

// ---------- 启动 ----------

async function handle(req, res) {
  let pathname
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  } catch {
    res.writeHead(400)
    res.end()
    return
  }

  if (pathname.startsWith('/api/')) {
    await handleApi(req, res, pathname)
    return
  }
  await serveStatic(res, pathname)
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    if (res.headersSent) {
      res.destroy()
      return
    }
    sendJson(res, 500, { error: err?.message || '服务器内部错误' })
  })
})

await loadData()
server.listen(PORT, '0.0.0.0', () => {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((info) => info?.family === 'IPv4' && !info.internal)
    .map((info) => info.address)
  console.log('纸阅服务已启动')
  console.log(`  本机访问:   http://localhost:${PORT}`)
  for (const addr of addresses) {
    console.log(`  局域网访问: http://${addr}:${PORT}`)
  }
  console.log(`  数据目录:   ${DATA_DIR}`)
})
