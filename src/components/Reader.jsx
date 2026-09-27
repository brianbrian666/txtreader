// 阅读器主体：顶栏 + 目录侧栏 + 阅读视图 + 底栏，处理翻页/翻章与进度同步

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ChapterSidebar from './ChapterSidebar.jsx'
import SettingsPanel from './SettingsPanel.jsx'
import PaginatedView from './PaginatedView.jsx'
import ScrollView from './ScrollView.jsx'
import { Icon } from './Icons.jsx'

const clamp = (v, min, max) => Math.min(Math.max(v, min), max)
const CONTENT_WIDTHS = { narrow: 640, normal: 800, wide: 1000 }

export default function Reader({
  meta,
  chapters,
  settings,
  onSettingsChange,
  progress,
  onProgress,
  onClose,
  onOpenFilePicker,
}) {
  const total = chapters.length
  const contentWidth = CONTENT_WIDTHS[settings.width] ?? 800

  // 全书字符累计，用于计算阅读百分比
  const cumulative = useMemo(() => {
    const arr = [0]
    for (let i = 0; i < chapters.length; i++) arr.push(arr[i] + chapters[i].charCount)
    return arr
  }, [chapters])
  const totalChars = cumulative[total] || 1

  const [chapterIndex, setChapterIndex] = useState(() =>
    clamp(progress?.chapter ?? 0, 0, total - 1),
  )
  const [enter, setEnter] = useState(() => ({
    key: 0,
    from: progress ? 'ratio' : 'start',
    ratio: progress?.ratio ?? 0,
  }))
  const [viewState, setViewState] = useState({ page: 0, pages: 1 })
  const [scrollRatio, setScrollRatio] = useState(progress?.ratio ?? 0)
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth > 1100,
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [chromeHidden, setChromeHidden] = useState(false)
  const viewRef = useRef(null)

  const chapter = chapters[chapterIndex]
  const ratio =
    settings.mode === 'page'
      ? viewState.pages > 1
        ? viewState.page / (viewState.pages - 1)
        : 0
      : scrollRatio
  const percent = clamp(
    (cumulative[chapterIndex] + ratio * chapter.charCount) / totalChars,
    0,
    1,
  )
  const ratioRef = useRef(ratio)
  useEffect(() => {
    ratioRef.current = ratio
  })

  const goToChapter = useCallback(
    (index, from = 'start', ratioValue = 0) => {
      const next = clamp(index, 0, total - 1)
      setChapterIndex(next)
      setEnter((e) => ({ key: e.key + 1, from, ratio: ratioValue }))
    },
    [total],
  )

  // 章节边界翻章（由阅读视图在页边界触发）
  const idxRef = useRef(chapterIndex)
  useEffect(() => {
    idxRef.current = chapterIndex
  })
  const wantNextChapter = useCallback(() => {
    if (idxRef.current < total - 1) goToChapter(idxRef.current + 1, 'start')
  }, [goToChapter, total])
  const wantPrevChapter = useCallback(() => {
    if (idxRef.current > 0) goToChapter(idxRef.current - 1, 'end')
  }, [goToChapter])

  // 切换阅读模式时保持位置比例
  const prevModeRef = useRef(settings.mode)
  useEffect(() => {
    if (prevModeRef.current === settings.mode) return
    prevModeRef.current = settings.mode
    setEnter((e) => ({ key: e.key + 1, from: 'ratio', ratio: ratioRef.current }))
  }, [settings.mode])

  // 进度上报
  useEffect(() => {
    onProgress(meta.id, {
      chapter: chapterIndex,
      ratio,
      percent,
      chapterTitle: chapters[chapterIndex].title,
    })
  }, [onProgress, meta.id, chapterIndex, ratio, percent, chapters])

  // 键盘快捷键
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.defaultPrevented) return
      const target = e.target
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return
      }
      if (e.key === 'Escape') {
        if (settingsOpen) setSettingsOpen(false)
        else if (sidebarOpen) setSidebarOpen(false)
        return
      }
      if (settingsOpen) return
      const isPageMode = settings.mode === 'page'
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault()
          viewRef.current?.next()
          break
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault()
          viewRef.current?.prev()
          break
        case 'ArrowDown':
          if (isPageMode) {
            e.preventDefault()
            viewRef.current?.next()
          }
          break
        case 'ArrowUp':
          if (isPageMode) {
            e.preventDefault()
            viewRef.current?.prev()
          }
          break
        case 'Home':
          if (isPageMode) {
            e.preventDefault()
            viewRef.current?.gotoPage(0)
          }
          break
        case 'End':
          if (isPageMode) {
            e.preventDefault()
            viewRef.current?.gotoPage(viewState.pages - 1)
          }
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [settingsOpen, sidebarOpen, settings.mode, viewState.pages])

  const toggleChrome = useCallback(() => {
    setChromeHidden((v) => !v)
    setSettingsOpen(false)
  }, [])

  const adjustFontSize = (delta) =>
    onSettingsChange({
      ...settings,
      fontSize: clamp(settings.fontSize + delta, 12, 32),
    })

  const handleSelectChapter = useCallback(
    (index) => {
      goToChapter(index, 'start')
      if (window.innerWidth <= 900) setSidebarOpen(false)
    },
    [goToChapter],
  )

  const sliderMax = settings.mode === 'page' ? Math.max(viewState.pages - 1, 1) : 100
  const sliderValue =
    settings.mode === 'page'
      ? Math.min(viewState.page, sliderMax)
      : Math.round(scrollRatio * 100)

  return (
    <div className={`reader ${chromeHidden ? 'chrome-hidden' : ''}`}>
      <header className="topbar">
        <div className="topbar-side left">
          <button type="button" className="icon-btn" title="返回书架" onClick={onClose}>
            <Icon name="back" />
          </button>
          <span className="topbar-book" title={meta.name}>
            {meta.name}
          </span>
        </div>
        <div className="topbar-center">
          <span className="topbar-chapter" title={chapter.title}>
            {chapter.title}
          </span>
          <span className="topbar-percent">{Math.round(percent * 100)}%</span>
        </div>
        <div className="topbar-side right">
          <button
            type="button"
            className={`icon-btn ${sidebarOpen ? 'active' : ''}`}
            title="目录"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            <Icon name="list" />
          </button>
          <div className="font-quick" title="调整字号">
            <button
              type="button"
              className="icon-btn"
              title="减小字号"
              onClick={() => adjustFontSize(-1)}
            >
              <Icon name="minus" size={15} />
            </button>
            <span className="font-quick-value">{settings.fontSize}</span>
            <button
              type="button"
              className="icon-btn"
              title="增大字号"
              onClick={() => adjustFontSize(1)}
            >
              <Icon name="plus" size={15} />
            </button>
          </div>
          <button type="button" className="icon-btn" title="打开本地 TXT" onClick={onOpenFilePicker}>
            <Icon name="upload" />
          </button>
          <div className="settings-anchor">
            <button
              type="button"
              className={`icon-btn ${settingsOpen ? 'active' : ''}`}
              title="阅读设置"
              onClick={() => setSettingsOpen((v) => !v)}
            >
              <Icon name="settings" />
            </button>
            {settingsOpen && (
              <SettingsPanel
                settings={settings}
                onChange={onSettingsChange}
                onClose={() => setSettingsOpen(false)}
              />
            )}
          </div>
        </div>
      </header>

      <div className="reader-body">
        <ChapterSidebar
          open={sidebarOpen}
          chapters={chapters}
          currentIndex={chapterIndex}
          onSelect={handleSelectChapter}
          onClose={() => setSidebarOpen(false)}
        />
        <div
          className={`sidebar-backdrop ${sidebarOpen ? 'show' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />
        <main className="reader-main">
          {settings.mode === 'page' ? (
            <PaginatedView
              ref={viewRef}
              chapter={chapter}
              enter={enter}
              settings={settings}
              contentWidth={contentWidth}
              onState={setViewState}
              onWantNextChapter={wantNextChapter}
              onWantPrevChapter={wantPrevChapter}
              onToggleChrome={toggleChrome}
            />
          ) : (
            <ScrollView
              ref={viewRef}
              chapter={chapter}
              enter={enter}
              settings={settings}
              contentWidth={contentWidth}
              onRatioChange={setScrollRatio}
              onWantNextChapter={wantNextChapter}
              onWantPrevChapter={wantPrevChapter}
            />
          )}
        </main>
      </div>

      <footer className="bottombar">
        <button
          type="button"
          className="btn ghost chapter-btn"
          onClick={() => goToChapter(chapterIndex - 1, 'start')}
          disabled={chapterIndex === 0}
        >
          上一章
        </button>
        <button
          type="button"
          className="icon-btn bordered"
          title="上一页"
          onClick={() => viewRef.current?.prev()}
        >
          <Icon name="chevron-left" />
        </button>
        <div className="pager">
          <input
            type="range"
            min="0"
            max={sliderMax}
            value={sliderValue}
            aria-label="阅读位置"
            onChange={(e) => {
              const v = Number(e.target.value)
              if (settings.mode === 'page') viewRef.current?.gotoPage(v)
              else viewRef.current?.gotoRatio(v / 100)
            }}
          />
          <div className="pager-info">
            <span className="pager-chapter" title={`${chapterIndex + 1}/${total} ${chapter.title}`}>
              {chapterIndex + 1}/{total} {chapter.title}
            </span>
            <span className="pager-page">
              {settings.mode === 'page'
                ? `第 ${viewState.page + 1}/${viewState.pages} 页`
                : `本章 ${Math.round(scrollRatio * 100)}%`}
            </span>
            <span className="pager-book">全书 {Math.round(percent * 100)}%</span>
          </div>
        </div>
        <button
          type="button"
          className="icon-btn bordered"
          title="下一页"
          onClick={() => viewRef.current?.next()}
        >
          <Icon name="chevron-right" />
        </button>
        <button
          type="button"
          className="btn ghost chapter-btn"
          onClick={() => goToChapter(chapterIndex + 1, 'start')}
          disabled={chapterIndex === total - 1}
        >
          下一章
        </button>
      </footer>
    </div>
  )
}
