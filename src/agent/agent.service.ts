import { Injectable } from '@angular/core'
import { AppService, NotificationsService, ConfigService } from 'tabby-core'
import { BaseTerminalTabComponent } from 'tabby-terminal'
import { Subscription } from 'rxjs'
import { inferDeviceTypeFromText, DeviceType } from '../device-map'
import { AiNetworkAgentConfig, AI_NETWORK_AGENT_CONFIG_KEY, DEFAULT_CONFIG } from '../config'

/** A single step the agent took */
export interface AgentStep {
  type: 'thinking' | 'executing' | 'output' | 'answer' | 'error' | 'confirm_danger'
  text: string
}

/** Callback so the sidebar can show live progress */
export type StepCallback = (step: AgentStep) => void

@Injectable()
export class AgentService {
  private tabOutputSubs = new WeakMap<any, Subscription>()
  private outputBuffers = new WeakMap<any, string>()
  private conversationMemory = new WeakMap<any, Array<{ role: string; content: string }>>()
  private pendingDangerousCommands = new WeakMap<any, { aiText: string; commands: string[]; thinking?: string; messages: any[] }>()
  private abortControllers = new WeakMap<any, AbortController>()
  private activeTerminalTab: any = null

  constructor(
    private app: AppService,
    private config: ConfigService,
    private notifications: NotificationsService,
  ) {
    this.app.activeTabChange$.subscribe(() => this.captureActiveTerminalTab())
    this.captureActiveTerminalTab()
  }

  getConfig(): AiNetworkAgentConfig {
    const stored = (this.config.store as any)[AI_NETWORK_AGENT_CONFIG_KEY] as AiNetworkAgentConfig | undefined
    return { ...DEFAULT_CONFIG, ...(stored ?? {}) }
  }

  getTargetTab(): any {
    return this.activeTerminalTab
  }

  getTargetTabName(): string {
    const tab = this.activeTerminalTab
    if (!tab) return '未选择终端'
    const profile = (tab as any).profile?.name ?? ''
    const title = tab.title || tab.customTitle || '终端'
    return profile ? `${title} (${profile})` : title
  }

  clearMemory(tab: any): void {
    if (tab) {
      this.conversationMemory.delete(tab)
      this.pendingDangerousCommands.delete(tab)
      this.abortControllers.get(tab)?.abort()
      this.abortControllers.delete(tab)
    }
  }

  abortCurrentRun(tab: any): void {
    if (tab) {
      this.abortControllers.get(tab)?.abort()
    }
  }

  /**
   * The main agent loop.
   * 1. Send user message to AI
   * 2. If AI says "execute" → run commands, capture output, send back to AI
   * 3. If AI says "answer" → return the final answer
   * 4. Repeat up to maxRounds
   */
  async runAgent(userMessage: string, onStep: StepCallback): Promise<void> {
    if (!this.activeTerminalTab) this.captureActiveTerminalTab()
    const tab = this.activeTerminalTab
    if (!tab) {
      onStep({ type: 'error', text: '未找到终端标签页，请先打开一个终端连接。' })
      return
    }

    const cfg = this.getConfig()
    if (!cfg.apiBaseUrl || !cfg.apiKey || !cfg.model) {
      onStep({ type: 'error', text: '请先在设置中配置 API 地址、密钥和模型名称。' })
      return
    }

    // Get recent terminal context
    const recentOutput = this.getRecentOutput(tab, cfg.contextLines)
    const memory = this.conversationMemory.get(tab) || []

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: cfg.systemPrompt },
      ...memory,
      {
        role: 'user',
        content: userMessage +
          (recentOutput ? `\n\n【当前终端最近输出】\n${recentOutput}` : ''),
      },
    ]

    let presetAction: any = null
    const pendingDanger = this.pendingDangerousCommands.get(tab)
    if (pendingDanger) {
      if (['确认执行', '确认', 'y', 'yes'].includes(userMessage.trim().toLowerCase())) {
        presetAction = pendingDanger
        // Restore conversation context to before the prompt
        messages.length = 0
        messages.push(...pendingDanger.messages)
        onStep({ type: 'answer', text: '已收到确认，开始执行高风险命令。' })
      }
      this.pendingDangerousCommands.delete(tab)
    }

    this.abortControllers.get(tab)?.abort()
    const abortCtrl = new AbortController()
    this.abortControllers.set(tab, abortCtrl)
    const signal = abortCtrl.signal

    const maxRounds = 30
    for (let round = 0; round < maxRounds; round++) {
      if (signal.aborted) {
        onStep({ type: 'answer', text: '🛑 任务已被用户手动终止。' })
        this.saveMessagesToMemory(tab, memory, messages)
        return
      }

      let aiText: string
      let parsed: any
      let isConfirmedAction = false

      if (presetAction) {
        aiText = presetAction.aiText
        parsed = { action: 'execute', commands: presetAction.commands, thinking: presetAction.thinking }
        isConfirmedAction = true
        presetAction = null
      } else {
        try {
          aiText = await this.callAI(messages, cfg, signal)
        } catch (err: any) {
          if (err.name === 'AbortError') {
            onStep({ type: 'answer', text: '🛑 任务已终止。' })
            return
          }
          onStep({ type: 'error', text: `AI 请求失败: ${err instanceof Error ? err.message : String(err)}` })
          this.saveMessagesToMemory(tab, memory, messages)
          return
        }

        parsed = this.parseAgentResponse(aiText)
        if (!parsed) {
          onStep({ type: 'answer', text: aiText })
          messages.push({ role: 'assistant', content: aiText })
          this.saveMessagesToMemory(tab, memory, messages)
          return
        }
      }

      const finalAnswer = parsed.content || parsed.thinking || aiText

      if (parsed.action === 'execute' && parsed.commands?.length) {
        if (parsed.thinking) {
          onStep({ type: 'thinking', text: parsed.thinking })
        }

        let commandsToExec = parsed.commands
        if (!isConfirmedAction) {
          const { safe, blocked } = this.sanitizeCommands(parsed.commands, cfg.allowNonReadonly)
          if (blocked.length > 0) {
            onStep({
              type: 'confirm_danger',
              text: `⚠️ 拦截到高危命令：\n${blocked.join('\n')}\n\n执行此类命令可能会导致设备重启、业务中断或清空配置。请慎重选择是否继续执行。`
            })
            this.pendingDangerousCommands.set(tab, {
              aiText,
              commands: parsed.commands,
              thinking: parsed.thinking,
              messages: [...messages]
            })
            return
          }
          commandsToExec = safe
          if (commandsToExec.length === 0) return
        }

        onStep({ type: 'executing', text: commandsToExec.join(' ; ') })

        let combinedOutput = ''
        for (const cmd of commandsToExec) {
          if (signal.aborted) {
            onStep({ type: 'answer', text: '🛑 任务已被用户手动终止。' })
            this.saveMessagesToMemory(tab, memory, messages)
            return
          }
          try {
            const output = await this.sendCommandAndCapture(tab, cmd, cfg.commandDelayMs, signal)
            combinedOutput += `\n$ ${cmd}\n${output}`
          } catch (err: any) {
            if (err.name === 'AbortError') {
              onStep({ type: 'answer', text: '🛑 任务已终止。' })
              return
            }
            throw err
          }
        }

        onStep({ type: 'output', text: combinedOutput.trim() })

        // Feed output back to AI
        messages.push({ role: 'assistant', content: aiText })
        messages.push({
          role: 'user',
          content: `命令已执行，以下是终端输出结果：\n${combinedOutput}\n\n请分析以上输出，用中文回答用户的问题。如果需要执行更多命令请继续返回 execute，否则返回 answer。`,
        })

        continue
      }

      // Action is answer or unknown
      onStep({ type: 'answer', text: finalAnswer })
      messages.push({ role: 'assistant', content: aiText })
      this.saveMessagesToMemory(tab, memory, messages)
      return
    }

    onStep({ type: 'answer', text: '防卡死保护：当前单次执行步数已达上限。如果你发现任务还没做完，可以直接回复“继续”，我会接着往下做。' })
    this.saveMessagesToMemory(tab, memory, messages)
  }

  private saveMessagesToMemory(tab: any, initialMemory: Array<{ role: string; content: string }>, currentMessages: Array<{ role: string; content: string }>): void {
    // The first item in currentMessages is the system prompt. We only want to save the user/assistant turns.
    const newTurns = currentMessages.slice(initialMemory.length + 1)
    const updatedMemory = [...initialMemory, ...newTurns]
    
    // Limit memory to the last 20 messages so the prompt doesn't get too bloated over time
    if (updatedMemory.length > 20) {
      updatedMemory.splice(0, updatedMemory.length - 20)
    }
    this.conversationMemory.set(tab, updatedMemory)
  }

  // ─── Terminal interaction ───

  private async sendCommandAndCapture(tab: any, command: string, delayMs: number, signal: AbortSignal): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'))

      let buffer = ''
      let silenceTimer: any
      let absoluteTimer: any

      const onAbort = () => {
        cleanup()
        reject(new DOMException('Aborted', 'AbortError'))
      }
      signal.addEventListener('abort', onAbort)

      const sub = tab.output$.subscribe((data: string) => {
        buffer += data
        // Reset silence timer on each data chunk
        clearTimeout(silenceTimer)
        silenceTimer = setTimeout(() => {
          cleanup()
          resolve(this.cleanOutput(buffer))
        }, Math.max(delayMs, 1500)) // wait for silence
      })

      // Send command
      tab.sendInput(command + '\r')

      // Absolute timeout
      absoluteTimer = setTimeout(() => {
        cleanup()
        resolve(this.cleanOutput(buffer))
      }, 10000) // 10s max

      function cleanup() {
        clearTimeout(silenceTimer)
        clearTimeout(absoluteTimer)
        signal.removeEventListener('abort', onAbort)
        sub.unsubscribe()
      }
    })
  }

  async captureFullConfig(onProgress: (msg: string) => void): Promise<string> {
    const tab = this.activeTerminalTab
    if (!tab) throw new Error('未选择终端')

    // Wake terminal
    tab.sendInput('\r')
    await new Promise(r => setTimeout(r, 200))

    // Disable pagination (Huawei/Cisco/H3C)
    onProgress('正在关闭终端分页（防止 config 需要按空格）...')
    tab.sendInput('screen-length 0 temporary\r')
    tab.sendInput('screen-length disable\r')
    tab.sendInput('terminal length 0\r')
    await new Promise(r => setTimeout(r, 600))

    // Send config commands
    onProgress('正在拉取完整配置，此过程可能长达十几秒，请勿操作键盘...')
    tab.sendInput('display current-configuration\r')
    tab.sendInput('show running-config\r')

    return new Promise<string>((resolve) => {
      let buffer = ''
      let silenceTimer: any
      let absoluteTimer: any
      
      const sub = tab.output$.subscribe((data: string) => {
        buffer += data
        clearTimeout(silenceTimer)
        // 3 seconds of terminal silence means it finished outputting the huge config
        silenceTimer = setTimeout(() => {
          cleanup()
          resolve(this.cleanOutput(buffer))
        }, 3000)
      })

      // 60 seconds absolute max
      absoluteTimer = setTimeout(() => {
        cleanup()
        resolve(this.cleanOutput(buffer))
      }, 60000)

      function cleanup() {
        clearTimeout(silenceTimer)
        clearTimeout(absoluteTimer)
        sub.unsubscribe()
      }
    })
  }

  saveTextToDesktop(filename: string, text: string): string {
    const os = (window as any).require('os')
    const path = (window as any).require('path')
    const fs = (window as any).require('fs')

    const desktop = path.join(os.homedir(), 'Desktop')
    const filepath = path.join(desktop, filename)
    fs.writeFileSync(filepath, text, 'utf8')
    return filepath
  }

  /** Strip ANSI escape codes from terminal output */
  private cleanOutput(raw: string): string {
    return raw
      .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/\x1B\][^\x07]*\x07/g, '')
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  private getRecentOutput(tab: any, lines: number): string {
    const buf = this.outputBuffers.get(tab)
    if (!buf) return ''
    const allLines = buf.split('\n')
    return allLines.slice(-lines).join('\n')
  }

  // ─── AI API call ───

  private async callAI(
    messages: Array<{ role: string; content: string }>,
    cfg: AiNetworkAgentConfig,
    signal: AbortSignal
  ): Promise<string> {
    const url = this.joinUrl(cfg.apiBaseUrl, cfg.apiPath)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (cfg.apiKey) {
      const prefix = cfg.apiAuthPrefix ? `${cfg.apiAuthPrefix} ` : ''
      headers[cfg.apiAuthHeader] = `${prefix}${cfg.apiKey}`
    }
    if (cfg.additionalHeadersJson.trim()) {
      try { Object.assign(headers, JSON.parse(cfg.additionalHeadersJson)) }
      catch { /* ignore */ }
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        model: cfg.model,
        temperature: cfg.temperature,
        max_tokens: cfg.maxTokens,
        messages,
      }),
    })

    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`)
    }

    const data = await resp.json()
    return data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? ''
  }

  // ─── Response parsing ───

  private parseAgentResponse(text: string): { action: string; commands?: string[]; content?: string; thinking?: string } | null {
    if (!text) return null
    const trimmed = text.trim()

    // Try direct parse
    let obj = this.safeParse(trimmed)
    if (obj?.action) return obj

    // Try extracting JSON from text
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (match) {
      obj = this.safeParse(match[0])
      if (obj?.action) return obj
    }

    return null
  }

  private safeParse(text: string): any {
    try {
      const obj = JSON.parse(text)
      return obj && typeof obj === 'object' ? obj : null
    } catch { return null }
  }

  // ─── Safety ───

  private sanitizeCommands(commands: string[], allowNonReadonly: boolean): { safe: string[], blocked: string[] } {
    const clean = commands.map(c => c.trim()).filter(c => c.length > 0 && !c.includes('\n'))
    if (allowNonReadonly) return { safe: clean, blocked: [] }
    const blockedKeywords = ['reload', 'reboot', 'shutdown', 'erase', 'format', 'write erase', 'delete', 'reset']
    const safe: string[] = []
    const blocked: string[] = []
    for (const cmd of clean) {
      if (blockedKeywords.some(kw => cmd.toLowerCase().includes(kw))) {
        blocked.push(cmd)
      } else {
        safe.push(cmd)
      }
    }
    return { safe, blocked }
  }

  // ─── Terminal tab detection ───

  captureActiveTerminalTab(): void {
    let target: any = this.app.activeTab

    if (target && this.isTerminalTab(target)) {
      this.setActiveTab(target)
      return
    }

    // SplitTabComponent
    if (target && typeof target.getFocusedTab === 'function') {
      const focused = target.getFocusedTab()
      if (focused && this.isTerminalTab(focused)) {
        this.setActiveTab(focused)
        return
      }
    }

    // Scan all tabs
    for (const tab of this.app.tabs) {
      if (this.isTerminalTab(tab)) { this.setActiveTab(tab); return }
      if (typeof (tab as any).getAllTabs === 'function') {
        for (const child of (tab as any).getAllTabs()) {
          if (this.isTerminalTab(child)) { this.setActiveTab(child); return }
        }
      }
    }
  }

  private isTerminalTab(tab: any): boolean {
    return tab instanceof BaseTerminalTabComponent
  }

  private setActiveTab(tab: any): void {
    this.activeTerminalTab = tab
    // Start capturing output if not already
    if (!this.tabOutputSubs.has(tab)) {
      let buffer = ''
      const sub = tab.output$.subscribe((data: string) => {
        buffer += data
        // Keep last N characters
        if (buffer.length > 50000) buffer = buffer.slice(-30000)
        this.outputBuffers.set(tab, this.cleanOutput(buffer))
      })
      this.tabOutputSubs.set(tab, sub)
      this.outputBuffers.set(tab, '')
    }
  }

  // ─── Utils ───

  private joinUrl(base: string, path: string): string {
    if (!base) return path
    if (base.endsWith('/') && path.startsWith('/')) return base.slice(0, -1) + path
    if (!base.endsWith('/') && !path.startsWith('/')) return base + '/' + path
    return base + path
  }
}
