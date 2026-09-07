#!/usr/bin/env node

// 本脚本只做检查和报告：失败输出 [FAIL:<CODE>] 并以 PREFLIGHT_FAILED=<CODE> 结束，
// 不阻断的问题输出 [WARN:<CODE>]。处理办法一律查 references/preflight-troubleshooting.md，脚本内不写修复指南，
// 也不执行任何安装、配置或写操作。

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const MIN_NODE_MAJOR = 18;
const EXPECTED_NAME = 'zhijilab-prototype';
const EXPECTED_REPOSITORY = 'git@git.woa.com:zjfe/zhijilab-prototype.git';
const TDESIGN_MCP_NAME = 'tdesign-mcp-server-http';
const TDESIGN_MCP_NAME_ALIAS = ['tdesign-mcp-server', 'tdesign-mcp', 'tdesign'];
const TDESIGN_MCP_URL = 'http://mcp.tdesign.woa.com/mcp';
const TAPD_MCP_NAME = 'tapd_mcp_http';
const TAPD_MCP_NAME_ALIAS = ['tapd-mcp-http', 'tapd-mcp', 'tapd'];
const TAPD_MCP_URL = 'https://mcpgw.knot.woa.com/tapd/';
const REQUIRED_FILES = ['AGENTS.md', 'src/App.tsx', 'src/page.ts', 'src/layouts/PlatformLayout.tsx'];

const isWindows = process.platform === 'win32';
const shim = (name) => (isWindows ? `${name}.cmd` : name);

const warnings = [];

const pass = (message) => console.log(`[PASS] ${message}`);

function warn(code, message) {
  console.log(`[WARN:${code}] ${message}`);
  warnings.push(code);
}

function fail(code, message) {
  console.error(`[FAIL:${code}] ${message}`);
  console.error(`PREFLIGHT_FAILED=${code}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  return {
    ok: !result.error && result.status === 0,
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim(),
  };
}

function parseArguments(argv) {
  const options = { projectDir: process.cwd(), requireTapd: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--project-dir') {
      const value = argv[index + 1];
      if (!value) fail('INVALID_ARGUMENT', '--project-dir 缺少路径。');
      options.projectDir = value;
      index += 1;
    } else if (argument === '--require-tapd') {
      options.requireTapd = true;
    } else if (argument === '-h' || argument === '--help') {
      console.log('Usage: node preflight.mjs [--project-dir <path>] [--require-tapd]');
      process.exit(0);
    } else {
      fail('INVALID_ARGUMENT', `未知参数：${argument}`);
    }
  }
  return options;
}

function checkNode() {
  const major = Number.parseInt(process.versions.node.split('.')[0], 10);
  if (!Number.isFinite(major) || major < MIN_NODE_MAJOR) {
    fail('NODE_UNSUPPORTED', `Node.js ${process.version} 低于要求的 v${MIN_NODE_MAJOR}。`);
  }
  pass(`node：${process.version}`);
}

function checkTool(command, label, missingCode) {
  const result = run(command, ['--version']);
  if (!result.ok || !result.stdout) fail(missingCode, `${label} 命令不可用。`);
  pass(`${label}：${result.stdout.split('\n')[0]}`);
}

function resolveProjectRoot(projectDir) {
  const absolute = resolve(projectDir);
  if (!existsSync(absolute)) fail('PROJECT_PATH_NOT_FOUND', `目录不存在：${absolute}`);
  if (!statSync(absolute).isDirectory()) fail('PROJECT_PATH_UNREADABLE', `不是目录：${absolute}`);

  const toplevel = run('git', ['-C', absolute, 'rev-parse', '--show-toplevel']);
  if (!toplevel.ok) fail('PROJECT_NOT_FOUND', `指定目录不在 Git 工程中：${absolute}`);
  return toplevel.stdout;
}

function checkProjectIdentity(projectRoot) {
  const packageJsonPath = resolve(projectRoot, 'package.json');
  if (!existsSync(packageJsonPath)) fail('PACKAGE_JSON_MISSING', '工程根目录缺少 package.json。');

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  } catch {
    fail('PACKAGE_JSON_INVALID', 'package.json 无法解析。');
  }

  const repository = typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url;
  if (manifest.name !== EXPECTED_NAME) {
    fail('PACKAGE_NAME_MISMATCH', `package.json name 为 ${manifest.name}，不是 ${EXPECTED_NAME}。`);
  }
  if (repository !== EXPECTED_REPOSITORY) {
    fail('REPOSITORY_URL_MISMATCH', `package.json repository 为 ${repository}，不是 ${EXPECTED_REPOSITORY}。`);
  }

  const missing = REQUIRED_FILES.filter((file) => !existsSync(resolve(projectRoot, file)));
  if (missing.length > 0) fail('PROJECT_FILES_MISSING', `工程缺少必需文件：${missing.join(', ')}`);
  pass('工程身份校验通过');
}

function checkGitRemote(projectRoot) {
  const origin = run('git', ['-C', projectRoot, 'remote', 'get-url', 'origin']);
  if (!origin.ok || !origin.stdout) fail('ORIGIN_MISSING', '仓库未配置 origin。');
  if (origin.stdout !== EXPECTED_REPOSITORY) {
    fail('ORIGIN_MISMATCH', `origin 指向 ${origin.stdout}，与 ${EXPECTED_REPOSITORY} 不一致。`);
  }
  pass(`Git origin：${origin.stdout}`);

  const remote = run('git', ['-C', projectRoot, 'ls-remote', 'origin', 'HEAD']);
  if (!remote.ok) {
    const output = `${remote.stdout}\n${remote.stderr}`;
    const isNetworkIssue = /could not resolve|resolve host|name or service not known|network is unreachable|failed to connect|timed out|timeout/i.test(output);
    if (isNetworkIssue) fail('GIT_WOA_NETWORK_UNAVAILABLE', '无法连接工蜂仓库。');
    fail('GIT_WOA_AUTH_REQUIRED', '当前 Git 环境无法访问工蜂仓库。');
  }
  pass('工蜂仓库访问通过');
}

function reportGitWorkspace(projectRoot) {
  const branch = run('git', ['-C', projectRoot, 'branch', '--show-current']).stdout || '(detached HEAD)';
  const changes = run('git', ['-C', projectRoot, 'status', '--porcelain']).stdout;
  pass(`Git 分支：${branch}`);
  pass(`Git 未提交变更：${changes ? changes.split('\n').length : 0}`);
  if (!run('git', ['-C', projectRoot, 'rev-parse', 'HEAD']).ok) {
    warn('NO_COMMITS', '当前分支尚无提交，工作区文件全部处于未跟踪状态。');
  }
}

function checkDependenciesAndBuild(projectRoot) {
  if (!run(shim('npm'), ['ls', '--depth=0'], { cwd: projectRoot }).ok) {
    fail('DEPENDENCIES_INVALID', 'npm 依赖缺失或不完整。');
  }
  pass('npm 依赖完整');

  const build = run(shim('npm'), ['run', 'build'], { cwd: projectRoot });
  if (!build.ok) {
    console.error(`${build.stdout}\n${build.stderr}`.trim().split('\n').slice(-20).join('\n'));
    fail('BUILD_FAILED', '工程初始构建失败。');
  }
  pass('工程初始构建通过');
}

function normalizeMcpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';

  try {
    const url = new URL(value.trim());
    url.hash = '';
    url.search = '';
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString().replace(/\/$/, '');
  } catch {
    return value.trim().replace(/\/+$/, '').toLowerCase();
  }
}

function normalizeMcpName(value) {
  return typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
}

function findMcpServer(servers, expectedName, nameAlias, expectedUrl) {
  const normalizedUrl = normalizeMcpUrl(expectedUrl);
  const urlMatch = servers.find((server) => normalizeMcpUrl(server.baseUrl ?? server.url) === normalizedUrl);
  if (urlMatch) return { server: urlMatch, matchedBy: 'url' };

  const acceptedNames = new Set([expectedName, ...nameAlias].map(normalizeMcpName));
  const nameMatch = servers.find((server) => acceptedNames.has(normalizeMcpName(server.name)));
  return nameMatch ? { server: nameMatch, matchedBy: 'name' } : undefined;
}

// mcporter 可以直接调用 import 来源（Cursor、Codex 等配置）的 server，无需先 config import，
// 因此 local 与 import 两个来源都要读，local 在前以便同名时优先命中。
function readMcpServers() {
  const collected = [];
  let readAnySource = false;

  for (const source of ['local', 'import']) {
    const result = run(shim('mcporter'), ['config', 'list', '--json', '--source', source]);
    if (!result.ok) continue;
    try {
      const parsed = JSON.parse(result.stdout);
      const servers = Array.isArray(parsed) ? parsed : parsed.servers ?? [];
      collected.push(...servers);
      readAnySource = true;
    } catch {
      continue;
    }
  }

  return readAnySource ? collected : undefined;
}

const describeSource = (server) => server.source?.importKind ?? server.source?.kind ?? 'unknown';

// MCP 只做软检查：智能体可能已挂载原生 TDesign / TAPD MCP，此时不需要 mcporter 兜底。
function inspectMcp(requireTapd) {
  const status = {
    tdesign: 'unavailable',
    tapd: requireTapd ? 'unavailable' : 'not-required',
    tdesignServer: '',
    tapdServer: '',
  };

  const version = run(shim('mcporter'), ['--version']);
  if (!version.ok) {
    warn('MCPORTER_MISSING', 'mcporter 命令不可用，无法在原生 MCP 缺失时兜底。');
    return status;
  }
  pass(`mcporter：${version.stdout.split('\n')[0]}`);

  const servers = readMcpServers();
  if (!servers) {
    warn('MCP_CONFIG_INVALID', 'mcporter 配置无法读取或无法解析。');
    return status;
  }

  const tdesignMatch = findMcpServer(servers, TDESIGN_MCP_NAME, TDESIGN_MCP_NAME_ALIAS, TDESIGN_MCP_URL);
  if (tdesignMatch) {
    status.tdesign = 'configured';
    status.tdesignServer = tdesignMatch.server.name;
    pass(`mcporter TDesign MCP：configured（${tdesignMatch.server.name}，来源 ${describeSource(tdesignMatch.server)}，按 ${tdesignMatch.matchedBy} 匹配）`);
  } else {
    status.tdesign = 'missing';
    warn('TDESIGN_MCP_MISSING', 'mcporter 的 local 与 import 来源中都没有 TDesign MCP。');
  }

  if (requireTapd) {
    const tapdMatch = findMcpServer(servers, TAPD_MCP_NAME, TAPD_MCP_NAME_ALIAS, TAPD_MCP_URL);
    const tapd = tapdMatch?.server;
    const authorization = tapd?.headers?.Authorization;
    const hasBearer = typeof authorization === 'string' && authorization.startsWith('Bearer ') && authorization.length > 7;

    if (!tapd) {
      status.tapd = 'missing';
      warn('TAPD_MCP_MISSING', 'mcporter 的 local 与 import 来源中都没有 TAPD MCP。');
    } else if (!hasBearer) {
      status.tapd = 'invalid-auth';
      warn('TAPD_MCP_AUTH_INVALID', `${tapd.name} 未配置有效的 Bearer Authorization。`);
    } else {
      status.tapd = 'configured';
      status.tapdServer = tapd.name;
      pass(`mcporter TAPD MCP：configured（${tapd.name}，来源 ${describeSource(tapd)}，按 ${tapdMatch.matchedBy} 匹配）`);
    }
  }

  return status;
}

const options = parseArguments(process.argv.slice(2));

checkNode();
checkTool(shim('npm'), 'npm', 'NPM_MISSING');
checkTool('git', 'git', 'GIT_MISSING');

const projectRoot = resolveProjectRoot(options.projectDir);
checkProjectIdentity(projectRoot);
checkGitRemote(projectRoot);
reportGitWorkspace(projectRoot);
checkDependenciesAndBuild(projectRoot);
const mcp = inspectMcp(options.requireTapd);

console.log(`PROJECT_ROOT=${projectRoot}`);
console.log(`TDESIGN_MCP=${mcp.tdesign}`);
console.log(`TDESIGN_MCP_SERVER=${mcp.tdesignServer}`);
console.log(`TAPD_MCP=${mcp.tapd}`);
console.log(`TAPD_MCP_SERVER=${mcp.tapdServer}`);
console.log(`WARNINGS=${warnings.join(',')}`);
console.log('PREFLIGHT_OK');
