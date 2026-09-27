import { useCallback, useEffect, useRef, useState } from 'react'
import StartScreen from './components/StartScreen.jsx'
import Reader from './components/Reader.jsx'
import { Icon } from './components/Icons.jsx'
import { readFileAsText } from './lib/encoding.js'
import { parseChapters } from './lib/chapterParser.js'
import { loadSettings, saveSettings } from './lib/storage.js'
import { api } from './lib/api.js'
import { SAMPLE_BOOK_NAME, SAMPLE_TEXT } from './lib/sampleBook.js'
import './App.css'

function App() {
  const [books, setBooks] = useState([])
  const [progressMap, setProgressMap] = useState({})
  const [settings, setSettings] = useState(() => loadSettings())
  const [current, setCurrent] = useState(null) // { meta, chapters }
  const [busy, setBusy] = useState(null) // 忙碌提示文案
  const [toast, setToast] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef(null)
  const booksRef = useRef(books)
  // 初始进度未从服务器加载完成前不回写，避免空数据覆盖服务器进度
  const progressReadyRef = useRef(false)

  useEffect(() => {
    booksRef.current = books
  })

  // 启动时从服务器加载书架与进度
  useEffect(() => {
    let cancelled = false
    Promise.all([api.listBooks(), api.loadProgress()])
      .then(([list, progress]) => {
        if (cancelled) return
        setBooks(list)
        setProgressMap(progress ?? {})
        progressReadyRef.current = true
      })
      .catch(() => {
        if (!cancelled) setToast('无法连接服务器，请确认已启动服务（npm start）')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  // 进度同步到服务器（防抖，失败静默待下次变更重试）
  useEffect(() => {
    if (!progressReadyRef.current) return
    const timer = setTimeout(() => {
      api.saveProgress(progressMap).catch(() => {})
    }, 500)
    return () => clearTimeout(timer)
  }, [progressMap])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(timer)
  }, [toast])

  const showToast = useCallback((message) => setToast(message), [])

  const openBookById = useCallback(
    async (id, preloadedText, preloadedMeta) => {
      setBusy('正在解析章节…')
      try {
        let text = preloadedText
        if (text == null) {
          text = await api.getBookText(id)
          if (!text) throw new Error('书籍数据缺失，请重新导入')
        }
        const meta = preloadedMeta ?? booksRef.current.find((b) => b.id === id)
        if (!meta) throw new Error('未找到书籍信息')
        // 让 loading 先渲染一帧再执行同步解析
        await new Promise((resolve) => setTimeout(resolve, 30))
        const chapters = parseChapters(text)
        setCurrent({ meta, chapters })
      } catch (err) {
        showToast(err?.message || '打开书籍失败')
      } finally {
        setBusy(null)
      }
    },
    [showToast],
  )

  const importFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []).filter((f) => f && f.size > 0)
      if (files.length === 0) return
      for (const file of files) {
        setBusy(`正在导入「${file.name}」…`)
        try {
          const text = await readFileAsText(file)
          if (!text.trim()) throw new Error('文件内容为空或无法解码')
          const meta = await api.uploadBook(file.name, text)
          setBooks((prev) => [meta, ...prev.filter((b) => b.id !== meta.id)])
          await openBookById(meta.id, text, meta)
        } catch (err) {
          showToast(err?.message || `导入「${file.name}」失败`)
        }
      }
      setBusy(null)
    },
    [openBookById, showToast],
  )

  const loadSample = useCallback(async () => {
    setBusy('正在载入示例…')
    try {
      const meta = await api.uploadBook(SAMPLE_BOOK_NAME, SAMPLE_TEXT)
      setBooks((prev) => [meta, ...prev.filter((b) => b.id !== meta.id)])
      await openBookById(meta.id, SAMPLE_TEXT, meta)
    } catch (err) {
      showToast(err?.message || '载入示例失败')
    } finally {
      setBusy(null)
    }
  }, [openBookById, showToast])

  const deleteBook = useCallback(
    async (id) => {
      const book = books.find((b) => b.id === id)
      if (!window.confirm(`删除「${book?.name ?? '书籍'}」？阅读进度将一并清除。`)) return
      try {
        await api.deleteBook(id)
      } catch (err) {
        showToast(err?.message || '删除失败')
        return
      }
      setBooks((prev) => prev.filter((b) => b.id !== id))
      setProgressMap((prev) => {
        if (!(id in prev)) return prev
        const next = { ...prev }
        delete next[id]
        return next
      })
    },
    [books, showToast],
  )

  const handleProgress = useCallback((bookId, patch) => {
    setProgressMap((prev) => {
      const cur = prev[bookId]
      if (
        cur &&
        cur.chapter === patch.chapter &&
        Math.abs((cur.ratio ?? 0) - (patch.ratio ?? 0)) < 0.002 &&
        Math.abs((cur.percent ?? 0) - (patch.percent ?? 0)) < 0.002
      ) {
        return prev
      }
      return { ...prev, [bookId]: { ...cur, ...patch, updatedAt: Date.now() } }
    })
  }, [])

  // 全局拖拽导入
  useEffect(() => {
    let depth = 0
    const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files')
    const onDragEnter = (e) => {
      if (!hasFiles(e)) return
      depth += 1
      setDragging(true)
    }
    const onDragOver = (e) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const onDragLeave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onDrop = (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      const files = e.dataTransfer?.files
      if (files?.length) importFiles(files)
    }
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [importFiles])

  const openFilePicker = useCallback(() => fileInputRef.current?.click(), [])

  return (
    <div className="app" data-theme={settings.theme}>
      {current ? (
        <Reader
          key={current.meta.id}
          meta={current.meta}
          chapters={current.chapters}
          settings={settings}
          onSettingsChange={setSettings}
          progress={progressMap[current.meta.id]}
          onProgress={handleProgress}
          onClose={() => setCurrent(null)}
          onOpenFilePicker={openFilePicker}
        />
      ) : (
        <StartScreen
          books={books}
          progressMap={progressMap}
          onOpenFilePicker={openFilePicker}
          onOpenBook={(id) => openBookById(id)}
          onDeleteBook={deleteBook}
          onLoadSample={loadSample}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,text/plain"
        multiple
        hidden
        onChange={(e) => {
          importFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {dragging && (
        <div className="drop-overlay">
          <div className="drop-overlay-card">
            <Icon name="upload" size={24} />
            松开鼠标，导入 TXT 书籍
          </div>
        </div>
      )}
      {busy && (
        <div className="busy-overlay">
          <div className="busy-card">
            <span className="spinner" aria-hidden="true" />
            {busy}
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

export default App
