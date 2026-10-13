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

// Windows 上 node 只能启动 .exe / .cmd，启动不了 Git Bash 的 shell 包装脚本
// （比如把代理塞进 -c 的 ~/bin/git）。那种情况下必须走 bash，否则会绕过包装、
// 以「直连」去连 GitHub——网络一断就推不上去，而 shell 里手敲 git 却是好的。
function resolveGitWrapper() {
  if (process.platform !== 'win32') return null;
  try {
    const resolved = execFileSync('bash', ['-lc', 'command -v git'], { encoding: 'utf8' }).trim();
    if (resolved && !/\.(exe|cmd|bat)$/i.test(resolved)) return resolved;
  } catch (_) {
    /* 没有 bash 就用默认的 git */
  }
  return null;
}
const GIT_WRAPPER = resolveGitWrapper();

function spawn(command, args, capture) {
  return execFileSync(command, args, {
    cwd: ROOT,
    encoding: capture ? 'utf8' : undefined,
    stdio: capture ? 'pipe' : 'inherit',
  });
}

const git = (args, capture) => {
  const out = GIT_WRAPPER ? spawn('bash', [GIT_WRAPPER, ...args], capture) : spawn('git', args, capture);
  return capture ? String(out).trim() : out;
};
const gh = (args, capture) => {
  const out = spawn('gh', args, capture);
  return capture ? String(out).trim() : out;
};

const step = (message) => console.log(`\n== ${message}`);
const ok = (message) => console.log(`✓ ${message}`);
const die = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

/* ---------- 1. 自检 ---------- */

step('自检');
spawn(process.execPath, ['scripts/verify.mjs']);

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
const dirty = git(['status', '--porcelain', '--untracked-files=no'], true);
if (dirty) die(`工作区有未提交的改动，先提交再发版：\n${dirty}`);
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], true);
if (branch !== 'main') die(`当前分支是 ${branch}，发版应在 main 上`);
try {
  gh(['auth', 'status'], true);
} catch {
  die('gh 未登录（先跑 gh auth login）');
}
ok(`工作区干净，分支 main，gh 已登录${GIT_WRAPPER ? '（git 走 shell 包装：' + GIT_WRAPPER + '）' : ''}`);

/* ---------- 4. tag ---------- */

step(`打 tag ${tag}`);
const head = git(['rev-parse', 'HEAD'], true);
if (git(['tag', '--list', tag], true)) {
  const tagged = git(['rev-list', '-n', '1', tag], true);
  if (tagged !== head) die(`tag ${tag} 已存在但指向别的提交（${tagged.slice(0, 7)} ≠ ${head.slice(0, 7)}），先处理这个 tag`);
  ok(`tag ${tag} 已存在且指向 HEAD，跳过`);
} else if (DRY) {
  ok(`[dry-run] git tag -a ${tag} -m ${version}`);
} else {
  git(['tag', '-a', tag, '-m', version]);
  ok(`已创建 ${tag}`);
}

/* ---------- 5. 推送 ---------- */

step('推送 main 与 tag');
if (DRY) {
  ok(`[dry-run] git push origin main && git push origin ${tag}`);
} else {
  try {
    git(['push', 'origin', 'main']);
    git(['push', 'origin', tag]);
  } catch {
    die('推送失败：检查网络 / 代理（代理不通时可临时 git -c http.proxy= push，或在 shell 里手动推送后重跑本脚本）');
  }
  ok('已推送');
}

/* ---------- 6. GitHub Release ---------- */

step('创建 GitHub Release');
let releaseExists = '';
try {
  releaseExists = gh(['release', 'view', tag, '--json', 'tagName'], true);
} catch {
  releaseExists = '';
}
if (releaseExists) {
  ok(`Release ${tag} 已存在，跳过`);
} else if (DRY) {
  ok(`[dry-run] gh release create ${tag} --title ${tag} --notes-file <CHANGELOG 条目>`);
} else {
  const repo = gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'], true);
  const previous = git(['tag', '--sort=-v:refname', '--list', 'v*'], true)
    .split('\n')
    .filter((name) => name && name !== tag)[0];
  const body = previous
    ? `${notes}\n\n**Full Changelog**: https://github.com/${repo}/compare/${previous}...${tag}\n`
    : `${notes}\n`;
  const dir = mkdtempSync(join(tmpdir(), 'penguin-release-'));
  const file = join(dir, 'notes.md');
  writeFileSync(file, body);
  try {
    gh(['release', 'create', tag, '--title', tag, '--notes-file', file]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  ok(`已发布 https://github.com/${repo}/releases/tag/${tag}`);
}

console.log('\n发版完成');
