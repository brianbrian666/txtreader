// 书架首页：文件导入（点击/拖拽）+ 书籍列表（进度、删除、示例书）

import { useState } from 'react'
import { Icon } from './Icons.jsx'

const COVER_COLORS = ['#5b8def', '#8e6fd8', '#4caf7d', '#d98a4e', '#c75d6e', '#3fa8b9']

function coverColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return COVER_COLORS[hash % COVER_COLORS.length]
}

function formatChars(count) {
  if (!count) return '未知字数'
  if (count < 10000) return `${count} 字`
  return `${(count / 10000).toFixed(1)} 万字`
}

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

export default function StartScreen({
  books,
  progressMap,
  onOpenFilePicker,
  onOpenBook,
  onDeleteBook,
  onLoadSample,
}) {
  const [dragOver, setDragOver] = useState(false)

  const sorted = [...books].sort(
    (a, b) =>
      (progressMap[b.id]?.updatedAt ?? b.addedAt ?? 0) -
      (progressMap[a.id]?.updatedAt ?? a.addedAt ?? 0),
  )

  return (
    <div className="start">
      <header className="start-hero">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="book" size={22} />
          </span>
          <h1>纸阅</h1>
          <span className="brand-sub">TXT 小说阅读器</span>
        </div>
        <p className="start-slogan">多设备共享书架 · 自动识别章节 · 自动识别 GBK / UTF-8 编码</p>
      </header>

      <div
        className={`dropzone ${dragOver ? 'over' : ''}`}
        onClick={onOpenFilePicker}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onOpenFilePicker()
        }}
      >
        <div className="dropzone-icon">
          <Icon name="upload" size={26} />
        </div>
        <div className="dropzone-main">点击选择或拖入 TXT 文件</div>
        <div className="dropzone-sub">支持一次导入多本 · 上传后局域网内所有设备共享书架</div>
        <button
          type="button"
          className="btn ghost sample-btn"
          onClick={(e) => {
            e.stopPropagation()
            onLoadSample()
          }}
        >
          没有文件？载入示例小说
        </button>
      </div>

      {sorted.length > 0 && (
        <section className="library">
          <div className="library-head">
            <h2>我的书架</h2>
            <span className="library-count">{sorted.length} 本</span>
          </div>
          <div className="book-grid">
            {sorted.map((book) => {
              const p = progressMap[book.id]
              const percent = Math.round((p?.percent ?? 0) * 100)
              const title = book.name.replace(/\.txt$/i, '')
              return (
                <article className="book-card" key={book.id}>
                  <button
                    type="button"
                    className="book-card-main"
                    onClick={() => onOpenBook(book.id)}
                    title={`打开《${title}》`}
                  >
                    <span className="book-cover" style={{ background: coverColor(book.name) }}>
                      {title.slice(0, 2)}
                    </span>
                    <span className="book-info">
                      <span className="book-name">{title}</span>
                      <span className="book-meta">
                        {book.chapterCount ? `${book.chapterCount} 章 · ` : ''}
                        {formatChars(book.charCount)}
                      </span>
                      <span className="book-meta">
                        {p?.updatedAt
                          ? `读至 ${formatDate(p.updatedAt)} · ${p.chapterTitle ?? ''}`
                          : `导入于 ${formatDate(book.addedAt)}`}
                      </span>
                    </span>
                  </button>
                  <div className="book-progress" aria-hidden="true">
                    <div className="book-progress-fill" style={{ width: `${percent}%` }} />
                  </div>
                  <div className="book-card-foot">
                    <span className="book-percent">{p ? `已读 ${percent}%` : '未开始'}</span>
                    <div className="book-actions">
                      <button type="button" className="btn primary small" onClick={() => onOpenBook(book.id)}>
                        {p ? '继续阅读' : '开始阅读'}
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title="删除本书"
                        onClick={() => onDeleteBook(book.id)}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      <footer className="start-foot">
        快捷键：← / → 翻页 · 空格 下一页 · Esc 关闭面板 · 点击页面中间区域隐藏工具栏
      </footer>
    </div>
  )
}
