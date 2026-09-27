// TXT 章节自动识别
// 支持：第X章/回/节/卷/集/部/篇、序章/楔子/尾声/番外、Chapter N、一、（一）等常见格式

const NUM = '0-9０-９〇零一二兩三四五六七八九十百千万萬壹貳贰叁肆伍陸柒捌玖拾佰仟'
const INDENT = '\\u0020\\u3000'
const SEP = `[${INDENT}:：、.．,，\\-—－·]*`

const HEADING_RE = new RegExp(
  [
    // 第 X 章/回/节/卷……（可带小标题）
    `^[${INDENT}]{0,4}第[${INDENT}]*[${NUM}]{1,15}[${INDENT}]*[章回節节卷集部篇]${SEP}[^\\n]{0,40}$`,
    // Chapter 1 / CHAPTER I
    `^[${INDENT}]{0,4}(?:Chapter|CHAPTER|chapter)[${INDENT}]+[${NUM}IVXLC]{1,10}[^\\n]{0,40}$`,
    // 序章 / 楔子 / 尾声 / 番外 等特殊章节
    `^[${INDENT}]{0,4}(?:序章|序言|序曲|楔子|引子|引言|前言|自序|終章|终章|尾声|尾聲|後記|后记|完本感言|完结感言|番外篇?|外传|外傳)${SEP}[^\\n]{0,30}$`,
    // 1、标题 / 一、标题
    `^[${INDENT}]{0,4}[${NUM}]{1,4}[${INDENT}]*[、.．:：][${INDENT}]*[^\\n]{0,40}$`,
    // （一）标题
    `^[${INDENT}]{0,4}[（(][${NUM}]{1,4}[)）][${INDENT}]*[^\\n]{0,40}$`,
  ].join('|'),
)

const PREAMBLE_MIN_CHARS = 50 // 正文前内容超过该长度时保留为「开篇」
const SPLIT_THRESHOLD = 150_000 // 单章超过该字符数时切分为多个子章，保证排版性能

function toParagraphs(lines) {
  const paragraphs = []
  for (const line of lines) {
    const text = line.replace(/^[\s\u3000]+/, '').replace(/[\s\u3000]+$/, '')
    if (text) paragraphs.push(text)
  }
  return paragraphs
}

function cleanTitle(raw) {
  let title = raw.replace(/[\s\u3000]+/g, ' ').trim()
  if (title.length > 32) title = `${title.slice(0, 32)}…`
  return title || '未命名章节'
}

function makeChapter(title, paragraphs) {
  return {
    title,
    paragraphs,
    charCount: paragraphs.reduce((sum, p) => sum + p.length, 0),
  }
}

// 无任何章节标记时按长度切块
function buildFallback(paragraphs) {
  if (paragraphs.length === 0) {
    return [makeChapter('正文', ['（空文档）'])]
  }
  const parts = []
  let current = []
  let length = 0
  for (const p of paragraphs) {
    current.push(p)
    length += p.length
    if (length >= 60_000) {
      parts.push(current)
      current = []
      length = 0
    }
  }
  if (current.length) parts.push(current)
  if (parts.length <= 1) return [makeChapter('正文', paragraphs)]
  return parts.map((ps, i) => makeChapter(`第 ${i + 1} 部分`, ps))
}

// 超长章节切分，避免一次性排版过多内容
function splitLargeChapter(chapter) {
  if (chapter.charCount <= SPLIT_THRESHOLD) return [chapter]
  const parts = []
  let current = []
  let length = 0
  for (const p of chapter.paragraphs) {
    current.push(p)
    length += p.length
    if (length >= SPLIT_THRESHOLD) {
      parts.push(current)
      current = []
      length = 0
    }
  }
  if (current.length) parts.push(current)
  return parts.map((ps, i) =>
    makeChapter(parts.length > 1 ? `${chapter.title}（${i + 1}）` : chapter.title, ps),
  )
}

/**
 * 解析 TXT 文本为章节数组
 * @param {string} raw 原始文本
 * @returns {Array<{title: string, paragraphs: string[], charCount: number}>}
 */
export function parseChapters(raw) {
  if (!raw) return [makeChapter('正文', ['（空文档）'])]

  const text = raw.replace(/\uFEFF/g, '').replace(/\r\n?/g, '\n')
  const lines = text.split('\n')

  // 扫描章节标题行
  const marks = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line || line.length > 60) continue
    const trimmed = line.trim()
    if (!trimmed || trimmed.length > 48) continue
    if (HEADING_RE.test(trimmed)) marks.push({ line: i, title: cleanTitle(trimmed) })
  }

  if (marks.length === 0) return buildFallback(toParagraphs(lines))

  const chapters = []

  // 第一个标题之前的内容
  const preamble = toParagraphs(lines.slice(0, marks[0].line))
  if (preamble.join('').length >= PREAMBLE_MIN_CHARS) {
    chapters.push(makeChapter('开篇', preamble))
  }

  for (let m = 0; m < marks.length; m++) {
    const start = marks[m].line + 1
    const end = m + 1 < marks.length ? marks[m + 1].line : lines.length
    const paragraphs = toParagraphs(lines.slice(start, end))
    if (paragraphs.length > 0) {
      chapters.push(makeChapter(marks[m].title, paragraphs))
    }
  }

  if (chapters.length === 0) return buildFallback(toParagraphs(lines))
  return chapters.flatMap(splitLargeChapter)
}
