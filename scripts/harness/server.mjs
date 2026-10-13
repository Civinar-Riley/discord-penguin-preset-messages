#!/usr/bin/env node
// 本地测试用静态服务器：serve harness 页面与仓库里的 userscript 本体。
// 用法：node scripts/harness/server.mjs [port]  → http://127.0.0.1:8756/test.html
// 加 ?hostile=1 走敌对模式（复刻 Discord 的抢焦点 / 剪辑 cancel 通道）。
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(dirname(HERE));
const PORT = Number(process.argv[2] || 8756);

createServer((req, res) => {
  const path = new URL(req.url, 'http://127.0.0.1').pathname;
  try {
    if (path === '/' || path === '/test.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(readFileSync(join(HERE, 'test.html')));
      return;
    }
    if (path === '/userscript.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end(readFileSync(join(ROOT, 'discord-penguin-preset-messages.user.js')));
      return;
    }
    res.writeHead(404).end('not found');
  } catch (error) {
    res.writeHead(500).end(String(error));
  }
}).listen(PORT, '127.0.0.1', () => console.log(`harness on http://127.0.0.1:${PORT}`));
