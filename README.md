# Tabby AI Network Agent Plugin

An AI-assisted, network-device focused agent panel for Tabby. It converts natural language into device-appropriate commands, detects device type when possible, and executes commands in the terminal with optional confirmation.

## Highlights
- Chat-style UI inside Tabby with friendly workflow
- Device-aware command mapping (Cisco, Huawei, Juniper, H3C, Arista, etc.)
- Optional agent planning with an NVIDIA OpenAI-compatible API
- Safe defaults: confirm before execution and read-only bias

## Build
```bash
npm install --legacy-peer-deps
npm run build
```

## Install in Tabby
1. Build the plugin (see above).
2. Open Tabby, go to **Settings** > **Plugins** > click **Open Plugins Directory**.
3. In the plugins directory, create a new folder named `tabby-ai-network-agent`.
4. Copy the following files/folders into it:
   - `dist/` (the entire folder)
   - `package.json`
   - `README.md`
   - `LICENSE`
5. Restart Tabby.
6. You should see a 🤖 robot icon in the toolbar.

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
