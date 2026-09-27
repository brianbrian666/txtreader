// 滚动模式视图：整章纵向滚动，支持比例定位与翻章

import { useEffect, useLayoutEffect, useRef } from 'react'

const clamp = (v, min, max) => Math.min(Math.max(v, min), max)

export default function ScrollView({
  chapter,
  enter,
  settings,
  contentWidth,
  onRatioChange,
  onWantNextChapter,
  onWantPrevChapter,
  ref,
}) {
  const scrollRef = useRef(null)
  const enterKeyRef = useRef(null)
  const wantNextRef = useRef(onWantNextChapter)
  const wantPrevRef = useRef(onWantPrevChapter)
  const notifyRef = useRef(onRatioChange)

  // 事件回调的最新引用（供指令 API 调用）
  useEffect(() => {
    wantNextRef.current = onWantNextChapter
    wantPrevRef.current = onWantPrevChapter
    notifyRef.current = onRatioChange
  })

  const reportRatio = () => {
    const el = scrollRef.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    const ratio = max > 0 ? clamp(el.scrollTop / max, 0, 1) : 1
    notifyRef.current?.(ratio)
  }

  // 章节切换时定位（内容同步渲染，在 layout 阶段直接滚动，避免闪烁）
  useLayoutEffect(() => {
    if (enterKeyRef.current === enter.key) return
    enterKeyRef.current = enter.key
    const el = scrollRef.current
    if (!el) return

    const max = el.scrollHeight - el.clientHeight
    let top = 0
    if (enter.from === 'end') top = max
    else if (enter.from === 'ratio') top = Math.round((enter.ratio || 0) * max)
    el.scrollTop = top
    reportRatio()
  }, [enter, chapter])

  // 滚动时上报比例（rAF 节流）
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        reportRatio()
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [chapter])

  const api = useRef({
    next: () => {
      const el = scrollRef.current
      if (!el) return
      const max = el.scrollHeight - el.clientHeight
      if (el.scrollTop >= max - 4) {
        wantNextRef.current?.()
        return
      }
      el.scrollBy({ top: el.clientHeight * 0.88, behavior: 'smooth' })
    },
    prev: () => {
      const el = scrollRef.current
      if (!el) return
      if (el.scrollTop <= 4) {
        wantPrevRef.current?.()
        return
      }
      el.scrollBy({ top: -el.clientHeight * 0.88, behavior: 'smooth' })
    },
    gotoRatio: (ratio) => {
      const el = scrollRef.current
      if (!el) return
      const max = el.scrollHeight - el.clientHeight
      el.scrollTop = (ratio || 0) * max
    },
  }).current

  useEffect(() => {
    if (ref) ref.current = api
  })

  return (
    <div className="sv-scroll" ref={scrollRef}>
      <article
        className={`sv-article font-${settings.fontFamily}`}
        style={{
          fontSize: `${settings.fontSize}px`,
          lineHeight: settings.lineHeight,
          maxWidth: contentWidth ? `${contentWidth}px` : undefined,
        }}
      >
        <h2 className="chapter-title">{chapter.title}</h2>
        {chapter.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <div className="sv-end">
          <div className="sv-end-line">本章完</div>
          <button type="button" className="btn ghost" onClick={() => wantNextRef.current?.()}>
            下一章
          </button>
        </div>
      </article>
    </div>
  )
}
