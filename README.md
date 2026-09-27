# 纸阅 · txtreader

局域网共享书架的 TXT 小说阅读器。书籍与阅读进度保存在服务器端，手机、平板、电脑访问同一地址即可共享书架、接续阅读。

## 功能

- 自动识别章节（第X章 / Chapter N / 序章 / 楔子等常见格式）
- 自动识别文件编码（UTF-8 / GBK / GB18030 / Big5 / UTF-16）
- 翻页 / 滚动两种阅读模式，多种背景主题、字号、行距、字体设置
- 书架与阅读进度多设备同步；阅读设置各设备独立（与屏幕相关）

## 生产部署（多设备共享）

```bash
npm install
npm run build   # 构建前端到 dist/
npm start       # 启动服务，默认端口 5174
```

启动后日志会打印局域网访问地址（`http://<局域网IP>:5174`），同一网络内的设备用浏览器打开即可。

- 书籍与进度数据保存在 `data/` 目录（`books.json`、`progress.json`、`books/*.txt`），已被 gitignore
- 自定义端口：`PORT=8080 npm start`

## 开发调试

需要两个终端同时运行：

```bash
node server.mjs   # 终端 1：API 服务器（端口 5174）
npm run dev       # 终端 2：Vite 开发服务器（/api 请求自动代理到 5174）
```

## 技术栈

React 19 + Vite 8；后端为原生 Node `http` 零依赖实现（`server.mjs`），章节解析逻辑前后端共用（`src/lib/chapterParser.js`）。
