# Tabby AI Network Agent Plugin

An AI-assisted, network-device focused agent panel for Tabby. It converts natural language into device-appropriate commands, detects device type when possible, and executes commands in the terminal with optional confirmation.

## Highlights
- Chat-style UI inside Tabby with friendly workflow
- Device-aware command mapping (Cisco, Huawei, Juniper, H3C, Arista, etc.)
- Optional agent planning with an NVIDIA OpenAI-compatible API
- Safe defaults: confirm before execution and read-only bias

## 安装 (Installation)

### 方法 1：一键安装 (小白推荐 / Windows Only)
如果您不熟悉编程或不想配置环境，可以直接使用一键脚本安装：
1. 从 GitHub 仓库下载整个项目的源代码压缩包 (`Download ZIP`) 并解压。
2. 双击运行解压文件夹中的 **`install.bat`** (Windows 批处理文件)。
3. 等待显示“部署成功”后，**重启您的 Tabby 终端**。
4. 打开 Tabby 点击右上角齿轮进入设置 -> `Plugins`，即可看到名为 `AI网络代理` 的插件。在终端右上角也能看到机器人的悬浮图标。

### 方法 2：手工编译安装 (开发者)
如果您想自己修改代码或重新编译：
```bash
npm install --legacy-peer-deps
npm run build
```
1. 编译完成后，打开 Tabby，进入 **Settings** > **Plugins** > 点击 **Open Plugins Directory**。
2. 在打开的 `plugins/node_modules` 目录下创建新文件夹 `tabby-ai-network-agent`。
3. 把 `dist/` 文件夹和 `package.json` 等关键文件存放入内。
4. 重启 Tabby。

## Configuration
Open Tabby Settings and find **AI Network Agent**.

Fields:
- API Base URL
- API Path (default `/v1/chat/completions`)
- API Key
- Model
- Temperature / Max Tokens
- Auto-execute and confirmation controls
- Optional custom device map JSON and system prompt

## Notes
This plugin is designed for network device diagnostics. It avoids destructive commands unless explicitly requested.
