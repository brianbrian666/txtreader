// 阅读设置存 localStorage（字号/主题等与设备屏幕相关，不同步服务器）
// 书籍与阅读进度存服务器，见 lib/api.js 与 server.mjs

const SETTINGS_KEY = 'txtreader.settings'

export const DEFAULT_SETTINGS = {
  fontSize: 18,
  lineHeight: 1.8,
  theme: 'paper',
  fontFamily: 'default',
  mode: 'page', // page | scroll
  width: 'normal', // narrow | normal | wide
}

export function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // 忽略写入失败（隐私模式等）
  }
}
