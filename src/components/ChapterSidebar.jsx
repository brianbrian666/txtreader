// 章节目录侧栏：搜索过滤 + 当前章节定位

import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icons.jsx'

export default function ChapterSidebar({ open, chapters, currentIndex, onSelect, onClose }) {
  const [query, setQuery] = useState('')
  const listRef = useRef(null)

  const items = useMemo(() => {
    const indexed = chapters.map((c, i) => ({ index: i, title: c.title }))
    const q = query.trim().toLowerCase()
    if (!q) return indexed
    return indexed.filter((c) => c.title.toLowerCase().includes(q))
  }, [chapters, query])

  useEffect(() => {
    if (!open) return
    const raf = requestAnimationFrame(() => {
      listRef.current
        ?.querySelector('.active')
        ?.scrollIntoView({ block: 'center' })
    })
    return () => cancelAnimationFrame(raf)
  }, [open, currentIndex])

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-head">
        <div className="sidebar-title">
          目录<span className="sidebar-count">{chapters.length}</span>
        </div>
        <button type="button" className="icon-btn" title="收起目录" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      <div className="sidebar-search">
        <Icon name="search" size={15} />
        <input
          type="text"
          value={query}
          placeholder="搜索章节"
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button type="button" className="icon-btn small" title="清空" onClick={() => setQuery('')}>
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
      <ol className="sidebar-list" ref={listRef}>
        {items.map(({ index, title }) => (
          <li key={index}>
            <button
              type="button"
              className={index === currentIndex ? 'active' : ''}
              onClick={() => onSelect(index)}
              title={title}
            >
              <span className="toc-index">{index + 1}</span>
              <span className="toc-title">{title}</span>
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="sidebar-empty">没有匹配的章节</li>}
      </ol>
    </aside>
  )
}
