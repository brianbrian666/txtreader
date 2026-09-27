// 后端 API 封装：书籍与进度全部读写服务器（server.mjs）

async function request(pathname, options = {}) {
  let res
  try {
    res = await fetch(pathname, options)
  } catch {
    throw new Error('无法连接服务器')
  }
  if (!res.ok) {
    let message = `请求失败（${res.status}）`
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      // 非 JSON 错误体，保留默认提示
    }
    throw new Error(message)
  }
  return res
}

async function requestJson(pathname, options) {
  const res = await request(pathname, options)
  return res.json()
}

export const api = {
  listBooks() {
    return requestJson('/api/books')
  },

  // 上传已解码的 UTF-8 全文，返回服务器生成的 meta（含 id / 章节数 / 字数）
  uploadBook(name, text) {
    return requestJson('/api/books', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'x-book-name': encodeURIComponent(name),
      },
      body: text,
    })
  },

  async getBookText(id) {
    const res = await request(`/api/books/${encodeURIComponent(id)}/text`)
    return res.text()
  },

  deleteBook(id) {
    return requestJson(`/api/books/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  loadProgress() {
    return requestJson('/api/progress')
  },

  saveProgress(map) {
    return requestJson('/api/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(map),
    })
  },
}
