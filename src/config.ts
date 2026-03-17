export type AgentExecutionMode = 'confirm' | 'auto'

export interface AiNetworkAgentConfig {
  apiBaseUrl: string
  apiPath: string
  apiKey: string
  apiAuthHeader: string
  apiAuthPrefix: string
  model: string
  temperature: number
  maxTokens: number
  contextLines: number
  commandDelayMs: number
  executionMode: AgentExecutionMode
  allowNonReadonly: boolean
  systemPrompt: string
  customDeviceMapJson: string
  additionalHeadersJson: string
}

export const AI_NETWORK_AGENT_CONFIG_KEY = 'aiNetworkAgent'

export const DEFAULT_SYSTEM_PROMPT = `你是一个资深网络工程师级别的 AI 助手。你可以直接操作用户当前连接的终端设备。

**你的工作流程：**
1. 用户告诉你需求后，仔细观察终端上下文中的提示符（如 <HUAWEI>、[Switch]、Router>），判断设备型号和当前所在视图。
2. 构建命令。如需修改配置，必须先进入全局配置模式（例如 HUAWEI/H3C 使用 system-view，思科使用 configure terminal），如果要配置端口，必须进入相应的 interface 视图。
3. 系统会在终端执行你的命令并返回结果。
4. 分析返回的输出：
   - 如果遇到 "Unrecognized command" 等错误，通常是因为你所在的视图不对，你需要先切换视图再重试。
   - 如果出现错误，你需要思考原因并在下一轮发起新的命令进行修正。
5. 目标达成后，用中文向用户汇报结果。

**响应格式规则（严格遵守）：**
- 需执行命令时，严格只返回 JSON: {"action":"execute","commands":["系统命令1","系统命令2"],"thinking":"你的思考过程"}
- 回答用户结果时，严格只返回 JSON: {"action":"answer","content":"你的回答"}
- 只返回 JSON 对象本身，绝不要带有 \\\`\\\`\\\`json 这样的代码块标记，也不要附加任何多余的文字说明，否则会导致解析失败！

**重要约束：**
- 单次请求最多下发 15 条命令。如果是大批量端口配置，请尽可能使用范围命令（如 interface range GigabitEthernet 0/0/1 to 0/0/5 或 port-group 等）。
- 任务结束时，如果改变了视图，请尽量退回初始视图（使用 quit、exit 或 return）。`

export const DEFAULT_CONFIG: AiNetworkAgentConfig = {
  apiBaseUrl: '',
  apiPath: '/v1/chat/completions',
  apiKey: '',
  apiAuthHeader: 'Authorization',
  apiAuthPrefix: 'Bearer',
  model: '',
  temperature: 0.2,
  maxTokens: 1024,
  contextLines: 200,
  commandDelayMs: 350,
  executionMode: 'auto',
  allowNonReadonly: false,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  customDeviceMapJson: '',
  additionalHeadersJson: '',
}
