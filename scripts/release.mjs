#!/usr/bin/env node
// 发版流程（对应 docs/PITFALLS.md 第四节）：
//   自检 → 检查工作区/分支 → 打 tag → push main + tag → 建 GitHub Release
// Release 说明自动取自 CHANGELOG.md 里对应版本的条目，并附上 Full Changelog 对比链接。
// 用法：node scripts/release.mjs [--dry-run]
// 前置：改动已提交、gh 已登录；脚本不会替你 commit。

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SCRIPT = 'discord-penguin-preset-messages.user.js';
const DRY = process.argv.includes('--dry-run');

const capture = (command, args) => execFileSync(command, args, { cwd: ROOT, encoding: 'utf8' }).trim();
const run = (command, args) => execFileSync(command, args, { cwd: ROOT, stdio: 'inherit' });
const step = (message) => console.log(`\n== ${message}`);
const ok = (message) => console.log(`✓ ${message}`);
const die = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

/* ---------- 1. 自检 ---------- */

step('自检');
run(process.execPath, ['scripts/verify.mjs']);

/* ---------- 2. 版本与 Release 说明 ---------- */

const source = readFileSync(join(ROOT, SCRIPT), 'utf8');
const version = (source.match(/^\/\/ @version\s+(\S+)\s*$/m) || [])[1];
if (!version) die('读不到脚本头里的 @version');
const tag = `v${version}`;

const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
const section = changelog.match(new RegExp(`## \\[${version.replace(/\./g, '\\.')}\\][\\s\\S]*?(?=\\n## \\[|$)`));
if (!section) die(`CHANGELOG.md 里找不到 [${version}] 条目`);
const notes = section[0].replace(/^## \[[^\]]+\][^\n]*\n+/, '').trim();
ok(`版本 ${version}，Release 说明 ${notes.length} 字（取自 CHANGELOG）`);

/* ---------- 3. 工作区与分支 ---------- */

step('检查工作区与分支');
// 只看已跟踪文件：.zcode/ 这类本地目录永远未跟踪，不该挡发版
const dirty = capture('git', ['status', '--porcelain', '--untracked-files=no']);
if (dirty) die(`工作区有未提交的改动，先提交再发版：\n${dirty}`);
const branch = capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== 'main') die(`当前分支是 ${branch}，发版应在 main 上`);
try {
  capture('gh', ['auth', 'status']);
} catch {
  die('gh 未登录（先跑 gh auth login）');
}
ok('工作区干净，分支 main，gh 已登录');

/* ---------- 4. tag ---------- */

step(`打 tag ${tag}`);
const head = capture('git', ['rev-parse', 'HEAD']);
if (capture('git', ['tag', '--list', tag])) {
  const tagged = capture('git', ['rev-list', '-n', '1', tag]);
  if (tagged !== head) die(`tag ${tag} 已存在但指向别的提交（${tagged.slice(0, 7)} ≠ ${head.slice(0, 7)}），先处理这个 tag`);
  ok(`tag ${tag} 已存在且指向 HEAD，跳过`);
} else if (DRY) {
  ok(`[dry-run] git tag -a ${tag} -m ${version}`);
} else {
  run('git', ['tag', '-a', tag, '-m', version]);
  ok(`已创建 ${tag}`);
}

/* ---------- 5. 推送 ---------- */

step('推送 main 与 tag');
if (DRY) {
  ok(`[dry-run] git push origin main && git push origin ${tag}`);
} else {
  try {
    run('git', ['push', 'origin', 'main']);
    run('git', ['push', 'origin', tag]);
  } catch {
    die('推送失败：检查网络 / 代理（git config http.proxy 指向的代理可能不通；可临时用 git -c http.proxy= 绕过）');
  }
  ok('已推送');
}

/* ---------- 6. GitHub Release ---------- */

step('创建 GitHub Release');
let releaseExists = '';
try {
  releaseExists = capture('gh', ['release', 'view', tag, '--json', 'tagName']);
} catch {
  releaseExists = '';
}
if (releaseExists) {
  ok(`Release ${tag} 已存在，跳过`);
} else if (DRY) {
  ok(`[dry-run] gh release create ${tag} --title ${tag} --notes-file <CHANGELOG 条目>`);
} else {
  const repo = capture('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
  const previous = capture('git', ['tag', '--sort=-v:refname', '--list', 'v*'])
    .split('\n')
    .filter((name) => name && name !== tag)[0];
  const body = previous
    ? `${notes}\n\n**Full Changelog**: https://github.com/${repo}/compare/${previous}...${tag}\n`
    : `${notes}\n`;
  const dir = mkdtempSync(join(tmpdir(), 'penguin-release-'));
  const file = join(dir, 'notes.md');
  writeFileSync(file, body);
  try {
    run('gh', ['release', 'create', tag, '--title', tag, '--notes-file', file]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  ok(`已发布 https://github.com/${repo}/releases/tag/${tag}`);
}

console.log('\n发版完成');
