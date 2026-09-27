// 阅读设置面板：主题背景、字号、行距、字体、阅读模式、页面宽度

import { useEffect, useRef } from 'react'
import { Icon } from './Icons.jsx'

const THEMES = [
  { id: 'light', label: '简洁白' },
  { id: 'paper', label: '纸张' },
  { id: 'green', label: '护眼' },
  { id: 'night', label: '夜间' },
  { id: 'black', label: '纯黑' },
]

const FONTS = [
  { id: 'default', label: '默认' },
  { id: 'song', label: '宋体' },
  { id: 'hei', label: '黑体' },
  { id: 'kai', label: '楷体' },
]

const LINE_HEIGHTS = [1.5, 1.7, 1.9, 2.1]
const WIDTHS = [
  { id: 'narrow', label: '窄' },
  { id: 'normal', label: '标准' },
  { id: 'wide', label: '宽' },
]
const MODES = [
  { id: 'page', label: '翻页' },
  { id: 'scroll', label: '滚动' },
]

function ChipGroup({ options, value, onChange, getLabel = (o) => o.label }) {
  return (
    <div className="chip-group" role="group">
      {options.map((option) => (
        <button
          key={option.id ?? option}
          type="button"
          className={`chip ${value === (option.id ?? option) ? 'active' : ''}`}
          onClick={() => onChange(option.id ?? option)}
        >
          {getLabel(option)}
        </button>
      ))}
    </div>
  )
}

export default function SettingsPanel({ settings, onChange, onClose }) {
  const panelRef = useRef(null)

  // 点击面板外部关闭（点击齿轮按钮本身由 toggle 处理，避免“关了叉开”）
  useEffect(() => {
    const onPointerDown = (e) => {
      if (panelRef.current && panelRef.current.contains(e.target)) return
      if (e.target instanceof Element && e.target.closest('.settings-anchor')) return
      onClose()
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    // 延迟绑定，避免打开面板的这一次点击立即触发关闭
    const timer = setTimeout(() => document.addEventListener('pointerdown', onPointerDown), 0)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const set = (patch) => onChange({ ...settings, ...patch })
  const adjustFontSize = (delta) =>
    set({ fontSize: Math.min(32, Math.max(12, settings.fontSize + delta)) })

  return (
    <div className="settings-panel" ref={panelRef} role="dialog" aria-label="阅读设置">
      <div className="settings-row">
        <div className="settings-label">背景主题</div>
        <div className="theme-swatches">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={`swatch swatch-${theme.id} ${settings.theme === theme.id ? 'active' : ''}`}
              title={theme.label}
              onClick={() => set({ theme: theme.id })}
            >
              <span className="swatch-label">{theme.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-label">字号</div>
        <div className="font-size-control">
          <button
            type="button"
            className="icon-btn bordered"
            title="减小字号"
            onClick={() => adjustFontSize(-1)}
          >
            <Icon name="minus" size={16} />
          </button>
          <input
            type="range"
            min="12"
            max="32"
            step="1"
            value={settings.fontSize}
            aria-label="字号大小"
            onChange={(e) => set({ fontSize: Number(e.target.value) })}
          />
          <span className="font-size-value">{settings.fontSize}</span>
          <button
            type="button"
            className="icon-btn bordered"
            title="增大字号"
            onClick={() => adjustFontSize(1)}
          >
            <Icon name="plus" size={16} />
          </button>
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-label">行距</div>
        <ChipGroup
          options={LINE_HEIGHTS}
          value={settings.lineHeight}
          onChange={(v) => set({ lineHeight: v })}
          getLabel={(o) => String(o)}
        />
      </div>

      <div className="settings-row">
        <div className="settings-label">字体</div>
        <div className="chip-group font-chips">
          {FONTS.map((font) => (
            <button
              key={font.id}
              type="button"
              className={`chip font-${font.id} ${settings.fontFamily === font.id ? 'active' : ''}`}
              onClick={() => set({ fontFamily: font.id })}
            >
              {font.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-label">阅读模式</div>
        <ChipGroup options={MODES} value={settings.mode} onChange={(v) => set({ mode: v })} />
      </div>

      <div className="settings-row">
        <div className="settings-label">页面宽度</div>
        <ChipGroup options={WIDTHS} value={settings.width} onChange={(v) => set({ width: v })} />
      </div>
    </div>
  )
}
