// 翻页模式视图：CSS 多列布局实现分页，每列一页
// 内部维护页码；enter 变化时定位到章首/章尾/指定比例；字号等排版变化时保持阅读比例

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

const clamp = (v, min, max) => Math.min(Math.max(v, min), max)

export default function PaginatedView({
  chapter,
  enter,
  settings,
  contentWidth,
  onState,
  onWantNextChapter,
  onWantPrevChapter,
  onToggleChrome,
  ref,
}) {
  const viewportRef = useRef(null)
  const stageRef = useRef(null)
  const columnsRef = useRef(null)

  const [size, setSize] = useState(null) // { w, h, gap }
  const [page, setPage] = useState(0)
  const [pages, setPages] = useState(1)

  const stateRef = useRef({ page: 0, pages: 1 })
  const enterKeyRef = useRef(null)
  const styleKeyRef = useRef('')
  const wantNextRef = useRef(onWantNextChapter)
  const wantPrevRef = useRef(onWantPrevChapter)

  // 事件回调的最新引用（供指令 API 调用）
  useEffect(() => {
    wantNextRef.current = onWantNextChapter
    wantPrevRef.current = onWantPrevChapter
  })

  const commit = useCallback(
    (targetPage, totalPages) => {
      const p = clamp(targetPage, 0, Math.max(0, totalPages - 1))
      stateRef.current = { page: p, pages: totalPages }
      setPage(p)
      setPages(totalPages)
      onState?.({ page: p, pages: totalPages })
    },
    [onState],
  )

  // 尺寸测量（stage 宽度受“页面宽度”设置约束，由 ResizeObserver 跟踪）
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const stage = stageRef.current
    if (!viewport || !stage) return

    const read = () => {
      const rect = stage.getBoundingClientRect()
      const w = Math.round(rect.width)
      const h = Math.round(rect.height)
      const pad = parseFloat(getComputedStyle(viewport).paddingLeft) || 0
      const gap = Math.max(40, Math.round(pad * 2))
      setSize((prev) =>
        prev && prev.w === w && prev.h === h && prev.gap === gap ? prev : { w, h, gap },
      )
    }

    read()
    const observer = new ResizeObserver(read)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  // 分页计算与定位
  useLayoutEffect(() => {
    if (!size || size.w <= 0 || size.h <= 0) return
    const el = columnsRef.current
    if (!el) return

    const { w, gap } = size
    const totalPages = Math.max(1, Math.round((el.scrollWidth + gap) / (w + gap)))

    const enterChanged = enterKeyRef.current !== enter.key
    const styleKey = `${size.w}|${size.h}|${settings.fontSize}|${settings.lineHeight}|${settings.fontFamily}`
    const styleChanged = styleKeyRef.current !== styleKey
    enterKeyRef.current = enter.key
    styleKeyRef.current = styleKey

    const { page: prevPage, pages: prevPages } = stateRef.current
    let target
    if (enterChanged) {
      if (enter.from === 'end') target = totalPages - 1
      else if (enter.from === 'ratio') {
        target = Math.round((enter.ratio || 0) * (totalPages - 1))
      } else target = 0
    } else if (styleChanged && totalPages > 1 && prevPages > 1) {
      // 排版变化（字号/行距/窗口尺寸）时按比例保持位置
      target = Math.round((prevPage / (prevPages - 1)) * (totalPages - 1))
    } else {
      target = prevPage
    }
    commit(target, totalPages)
  }, [
    chapter,
    enter,
    size,
    settings.fontSize,
    settings.lineHeight,
    settings.fontFamily,
    commit,
  ])

  const commitRef = useRef(commit)
  useEffect(() => {
    commitRef.current = commit
  })

  // 对外暴露的翻页指令（通过 commitRef 保证始终引用最新实现）
  const api = useRef({
    next: () => {
      const { page: p, pages: n } = stateRef.current
      if (p < n - 1) commitRef.current(p + 1, n)
      else wantNextRef.current?.()
    },
    prev: () => {
      const { page: p, pages: n } = stateRef.current
      if (p > 0) commitRef.current(p - 1, n)
      else wantPrevRef.current?.()
    },
    gotoPage: (target) => {
      const { pages: n } = stateRef.current
      commitRef.current(target, n)
    },
    gotoRatio: (ratio) => {
      const { pages: n } = stateRef.current
      commitRef.current(Math.round((ratio || 0) * (n - 1)), n)
    },
  }).current

  useEffect(() => {
    if (ref) ref.current = api
  })

  const offset = size ? page * (size.w + size.gap) : 0

  return (
    <div className="pv-viewport" ref={viewportRef}>
      <div
        className="pv-stage"
        ref={stageRef}
        style={contentWidth ? { maxWidth: `${contentWidth}px` } : undefined}
      >
        <div
          ref={columnsRef}
          className={`pv-columns font-${settings.fontFamily}`}
          style={{
            width: size ? `${size.w}px` : undefined,
            height: size ? `${size.h}px` : undefined,
            columnWidth: size ? `${size.w}px` : undefined,
            columnGap: size ? `${size.gap}px` : undefined,
            fontSize: `${settings.fontSize}px`,
            lineHeight: settings.lineHeight,
            transform: `translateX(-${offset}px)`,
          }}
        >
          <h2 className="chapter-title">{chapter.title}</h2>
          {chapter.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        {size && (
          <>
            <button type="button" className="pv-zone left" aria-label="上一页" onClick={() => api.prev()} />
            <button
              type="button"
              className="pv-zone middle"
              aria-label="显示/隐藏工具栏"
              onClick={onToggleChrome}
            />
            <button type="button" className="pv-zone right" aria-label="下一页" onClick={() => api.next()} />
            <div className="pv-footer">
              {page + 1} / {pages}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
