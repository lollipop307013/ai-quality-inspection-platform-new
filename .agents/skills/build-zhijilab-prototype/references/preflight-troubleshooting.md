# 前置检查失败排查与修复

只在前置检查脚本输出 `[FAIL:<CODE>]` 或 `[WARN:<CODE>]` 时阅读本文档，按对应的 CODE 处理。脚本直接输出 `PREFLIGHT_OK` 且没有警告时不需要读。

脚本只报告问题，不修复；所有修复动作由智能体按下面的规则执行。

## 通用规则

- 任何安装、全局配置、写入 MCP 配置或改动 Git 远端的动作，执行前必须先向用户说明将要执行的完整命令和影响范围，并用 AskQuestion 取得明确同意。没有得到同意就不执行，也不改用其他命令绕过。
- 只读检查命令（`--version`、`mcporter config list`、`git remote get-url` 等）可以直接执行，不需要确认。
- 用户拒绝修复时停止流程，说明缺少该环境会导致哪一步无法进行，不降级为猜测、模拟或跳过。
- 修复完成后重新运行完整前置检查，以输出 `PREFLIGHT_OK` 为准，不凭单个命令成功就继续。
- `[WARN:<CODE>]` 不阻断流程，但要在继续前判断它是否影响本次需求，并在需要时按本文档处理。

## Node.js 与 npm

**`NODE_MISSING`** 不由脚本产出，因为脚本本身需要 Node.js 才能运行。出现以下任一情况即判定为 `NODE_MISSING`，此时不要反复重试脚本：

- `node --version` 无法执行或找不到命令。
- `node <skill-directory>/scripts/preflight.mjs` 报告找不到 `node`、无法启动，或没有任何 `[PASS]` / `[FAIL:...]` 输出。

**`NODE_UNSUPPORTED`** 表示 Node.js 版本低于 v18。**`NPM_MISSING`** 表示 Node.js 可用但 `npm` 命令不可用。

处理办法：

1. 先确认智能体自带的 Node.js 运行时是否可用，可用就优先使用它，并用它重新运行前置检查。
2. 仍不可用时，向用户说明需要 Node.js LTS（npm 随 Node.js 一起安装），并询问是否需要代为安装。
3. 得到同意后按用户机器上已有的方式安装：已安装 nvm 就用 nvm 安装 LTS，否则使用官方 LTS 安装包。不擅自更换用户的版本管理方式，不修改用户的 shell 配置。
4. 安装后重新运行前置检查。

## Git 与工蜂访问

- **`GIT_MISSING`**：没有可用的 `git` 命令。
- **`GIT_WOA_AUTH_REQUIRED`**：`git` 可用，但无法访问工蜂仓库，通常是未完成工蜂认证或没有仓库权限。
- **`GIT_WOA_NETWORK_UNAVAILABLE`**：网络层面连不上工蜂。

`GIT_MISSING` 和 `GIT_WOA_AUTH_REQUIRED` 的处理办法：向用户说明当前缺少 Git 环境或工蜂访问能力，并询问是否安装“非研发同学接入工蜂”技能来解决。得到同意后：

1. 检查是否已安装 knot-skill 命令行工具；未安装时按 https://mirrors.tencent.com/repository/generic/knot-skill/install.md 安装。
2. 用 knot-skill 安装 ID 为 23382 的“非研发同学接入工蜂”技能。
3. 按该技能的指引完成 Git 环境准备与工蜂认证，再重新运行前置检查。

认证已完成但仍被拒绝时，属于仓库权限不足，只能由用户申请 `zjfe/zhijilab-prototype` 的权限。不要尝试更换协议、更换账号或改写远端地址绕过。

`GIT_WOA_NETWORK_UNAVAILABLE` 不需要安装任何东西：提示用户检查公司网络、VPN、DNS 和智能体网络权限，恢复后重新运行前置检查。

## mcporter

**`MCPORTER_MISSING`** 表示没有可用的 `mcporter` 命令。mcporter 只在智能体没有挂载原生 TDesign / TAPD MCP 时作为兜底使用，先确认原生 MCP 是否可用，可用就忽略这个警告。

需要兜底时，向用户说明将要执行下面的全局安装并询问是否执行：

```bash
npm install -g @tencent/mcporter-internal --registry=https://mirrors.tencent.com/npm
```

该包同时提供 `mcporter` 和 `mcporter-internal` 两个命令，安装后有 `mcporter` 命令即可。得到同意并安装后重新运行前置检查。

## MCP 配置

以下都是警告，原生 MCP 可用时可以忽略。需要 mcporter 兜底时按下面处理，每条 `mcporter config add` 都要先取得用户同意再执行。

前置检查同时读取 mcporter 的 local 与 import 两个来源，import 包含 Cursor、Codex 等工具自己的 MCP 配置。这类 server 可以直接用 `mcporter list` 和 `mcporter call` 调用，不需要先执行 `mcporter config import`，也不要为了让它出现在 local 列表而重复添加一份配置。各人机器上的 server 名不同，一律使用前置检查输出的 `TDESIGN_MCP_SERVER` 与 `TAPD_MCP_SERVER`。

**`MCP_CONFIG_INVALID`**：让用户运行 `mcporter config doctor` 排查，不要替用户重写配置文件。

**`TDESIGN_MCP_MISSING`**：

```bash
mcporter config add tdesign-mcp-server-http --url http://mcp.tdesign.woa.com/mcp --transport http --scope home
```

**`TAPD_MCP_MISSING`** 和 **`TAPD_MCP_AUTH_INVALID`**：需要太湖个人令牌，只能由用户自己申请和填写。

1. 告知用户从 https://tai.it.woa.com/user/pat 申请令牌，并参考 https://iwiki.woa.com/p/4016834150 中的个人令牌说明。
2. 由用户执行下面的命令，注意不要遗漏 `Bearer ` 前缀：

```bash
mcporter config add tapd_mcp_http --url https://mcpgw.knot.woa.com/tapd/ --transport http --header "Authorization=Bearer tai_xxx" --scope home
```

3. 令牌只允许存在于用户本机的 mcporter 配置中。智能体不得读取、回显令牌，不得写入仓库或聊天内容，也不代替用户执行含真实令牌的命令。

## 工程与仓库状态

这些不是环境缺失，不需要安装任何东西，也不要为了通过检查而改动工程文件。

- **`INVALID_ARGUMENT`**：检查脚本参数，为包含空格的路径加上引号。
- **`PROJECT_PATH_NOT_FOUND`**、**`PROJECT_PATH_UNREADABLE`**：检查工程路径和读取权限，或询问用户 ZhijiLab 原型工程所在的目录。
- **`PROJECT_NOT_FOUND`**：指定目录不在 Git 工程中，改用工程所在目录重新运行前置检查。
- **`PACKAGE_JSON_MISSING`**、**`PACKAGE_JSON_INVALID`**、**`PACKAGE_NAME_MISMATCH`**、**`REPOSITORY_URL_MISMATCH`**：当前目录不是可确认的目标工程。选择正确的工程目录，禁止修改 `package.json` 绕过检查。
- **`PROJECT_FILES_MISSING`**：检查当前分支和仓库完整性。不要伪造文件，也不要 reset、checkout 或覆盖用户已有修改。
- **`ORIGIN_MISSING`**：需要执行 `git remote add origin git@git.woa.com:zjfe/zhijilab-prototype.git`。这会改动用户的仓库配置，执行前先取得用户同意。
- **`ORIGIN_MISMATCH`**：origin 指向了别的仓库，通常是选错了工程目录。先与用户核对，不要擅自改写已有的远端配置。
- **`NO_COMMITS`**（警告）：开始修改前先 `git pull --rebase origin main` 建立历史。未跟踪文件与远端同名时逐个核对内容，不要直接删除或覆盖。
- **`DEPENDENCIES_INVALID`**：在工程根目录运行 `npm ci`；仓库没有 `package-lock.json` 时运行 `npm install`。不升级或切换依赖。
- **`BUILD_FAILED`**：按脚本打印的构建输出末尾定位并修复错误。不要关闭类型检查或修改构建流程绕过错误。
