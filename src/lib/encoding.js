// TXT 文件读取与编码自动识别（UTF-8 / GBK / GB18030 / Big5 / UTF-16）

export async function readFileAsText(file) {
  const buffer = await file.arrayBuffer()
  return decodeBuffer(buffer)
}

export function decodeBuffer(buffer) {
  const bytes = new Uint8Array(buffer)

  // BOM 优先
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(buffer)
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buffer)
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buffer)
  }

  // 严格 UTF-8：一旦出现非法字节序列立即失败
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    // 落入中文 legacy 编码
  }

  for (const encoding of ['gb18030', 'big5']) {
    try {
      return new TextDecoder(encoding).decode(buffer)
    } catch {
      // 尝试下一种
    }
  }

  // 兜底：带替换字符的 UTF-8
  return new TextDecoder('utf-8').decode(buffer)
}
