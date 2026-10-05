#!/usr/bin/env node
// 仓库自检：userscript 元信息头、版本一致性、对外文档解耦。
// 本地运行：node scripts/verify.mjs

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (relative) => readFileSync(join(ROOT, relative), 'utf8');

const SCRIPT = 'discord-penguin-preset-messages.user.js';
const LICENSE_NAME = 'PolyForm-Noncommercial-1.0.0';
const OWNER = 'Civinar-Riley';
const REPO = 'discord-penguin-preset-messages';
// 作者 handle 里带 "Civi"，这是仓库 URL 的一部分；除此之外对外文档不得出现该词。
const RAW_URL = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/${SCRIPT}`;
const TEXT_EXTENSIONS = new Set(['.md', '.js', '.mjs', '.yml', '.yaml', '.json', '.txt']);
// 解耦检查只覆盖用户看得见的文件。docs/PLAN.md 是内部设计记录，保留项目名引用是有意的。
const PUBLIC_FILES = [SCRIPT, 'README.md'];
const ALLOWED_GRANTS = ['GM_setValue', 'GM_getValue', 'GM_deleteValue'];

let failed = 0;
const pass = (message) => console.log(`✓ ${message}`);
const fail = (message) => {
  failed++;
  console.error(`✗ ${message}`);
};

/* ---------- 1. 元信息头 ---------- */

const source = read(SCRIPT);
const block = source.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);
if (!block) {
  fail('找不到 // ==UserScript== 元信息块');
  process.exit(1);
}

const meta = {};
for (const line of block[1].split(/\r?\n/)) {
  const match = line.match(/^\/\/ @([A-Za-z][\w-]*)(?:\s+(.*))?$/);
  if (match) (meta[match[1]] ||= []).push((match[2] || '').trim());
}
pass(`元信息头解析到 ${Object.keys(meta).length} 个字段`);

for (const key of ['name', 'namespace', 'version', 'description', 'author', 'match', 'grant', 'license', 'downloadURL', 'updateURL', 'noframes', 'run-at']) {
  if (!(key in meta)) fail(`缺少必填字段 @${key}`);
}

for (const [key, expected] of Object.entries({
  name: '企鹅预设消息',
  license: LICENSE_NAME,
  match: 'https://discord.com/*',
  namespace: `https://github.com/${OWNER}/${REPO}`,
})) {
  if (meta[key]?.[0] !== expected) fail(`@${key} 应为「${expected}」，实际为「${meta[key]?.[0]}」`);
}

for (const key of ['downloadURL', 'updateURL']) {
  if (meta[key]?.[0] !== RAW_URL) fail(`@${key} 应为 ${RAW_URL}`);
}

for (const key of ['GM_xmlhttpRequest', 'unsafeWindow', 'GM_openInTab']) {
  if (key in meta) fail(`@${key} 与「零网络请求」红线冲突`);
}

const grants = meta.grant || [];
if (!grants.length) fail('@grant 至少要声明一个存储方法');
for (const grant of grants) {
  if (!ALLOWED_GRANTS.includes(grant)) fail(`@grant ${grant} 超出「纯本地存储」范围`);
}

/* ---------- 2. 版本号一致性 ---------- */

const version = meta.version?.[0] || '';
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  fail(`@version 应为 x.y.z，实际为「${version}」`);
} else {
  const changelog = read('CHANGELOG.md');
  if (!changelog.includes(`[${version}]`)) fail(`CHANGELOG.md 缺少 [${version}] 条目`);
}

/* ---------- 3. LICENSE ---------- */

if (!read('LICENSE').includes('PolyForm Noncommercial License 1.0.0')) {
  fail('LICENSE 文件不是 PolyForm Noncommercial License 1.0.0 原文');
}

/* ---------- 4. 对外文档解耦检查 ---------- */

for (const file of PUBLIC_FILES) {
  const text = read(file).split(OWNER).join('');
  if (/[Cc]ivi/.test(text)) fail(`${file} 除作者 handle 外仍包含外部项目名`);
}

/* ---------- 结果 ---------- */

if (failed) {
  console.error(`\n自检失败：${failed} 项未通过`);
  process.exit(1);
}
console.log('\n自检通过');
