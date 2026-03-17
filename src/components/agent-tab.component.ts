import { Component, Injector, OnDestroy, OnInit } from '@angular/core'
import { BaseTabComponent, AppService } from 'tabby-core'
import { NotificationsService } from 'tabby-core'
import { Subscription } from 'rxjs'
import { AgentPlan, AgentService } from '../agent/agent.service'
import { DEVICE_LABELS, DeviceType } from '../device-map'
import { AiNetworkAgentConfig, DEFAULT_CONFIG } from '../config'
import template from './agent-tab.component.html'
import styles from './agent-tab.component.scss'

type MessageRole = 'user' | 'assistant' | 'system'

interface ChatMessage {
  id: string
  role: MessageRole
  text: string
  plan?: AgentPlan
  warning?: string
}

@Component({
  selector: 'ai-network-agent-tab',
  template,
  styles: [styles],
})
export class AgentTabComponent extends BaseTabComponent implements OnInit, OnDestroy {
  title = 'AI Network Agent'
  icon = 'fas fa-robot'

  messages: ChatMessage[] = []
  inputText = ''
  isBusy = false

  config: AiNetworkAgentConfig = { ...DEFAULT_CONFIG }
  targetTabName = 'No terminal selected'
  targetTabId: string | null = null
  deviceType: DeviceType = 'unknown'

  private subs: Subscription[] = []

  constructor(
    injector: Injector,
    private app: AppService,
    private agent: AgentService,
    private notifications: NotificationsService,
  ) {
    super(injector)
  }

  ngOnInit(): void {
    this.refreshConfig()
    this.refreshTarget()
    this.subs.push(
      this.app.activeTabChange$.subscribe(() => this.refreshTarget()),
    )
  }

  ngOnDestroy(): void {
    for (const sub of this.subs) sub.unsubscribe()
  }

  async send(): Promise<void> {
    const text = this.inputText.trim()
    if (!text) return

    this.addMessage('user', text)
    this.inputText = ''
    this.isBusy = true

    try {
      this.refreshConfig()
      const result = await this.agent.buildPlan(text)
      this.addMessage('assistant', result.plan.summary, result.plan, result.warning)
      this.refreshTarget()
      if (this.config.executionMode === 'auto' && !result.plan.needsDetection) {
        await this.executePlan(result.plan)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed.'
      this.addMessage('system', message)
    } finally {
      this.isBusy = false
    }
  }

  async executePlan(plan: AgentPlan): Promise<void> {
    try {
      await this.agent.executePlan(plan)
      this.addMessage('system', 'Commands sent to terminal.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to execute commands.'
      this.addMessage('system', message)
    }
  }

  async detectDevice(plan: AgentPlan): Promise<void> {
    try {
      const detected = await this.agent.detectDevice(plan)
      this.deviceType = detected
      const updatedPlan = this.agent.applyDeviceToPlan(plan, detected)
      this.replacePlan(updatedPlan)
      this.addMessage('system', `Detected device type: ${DEVICE_LABELS[detected]}.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Device detection failed.'
      this.addMessage('system', message)
    }
  }

  copyCommands(plan: AgentPlan): void {
    const text = plan.commands.join('\n')
    if (!text) return
    const clipboard = (navigator as any)?.clipboard
    if (clipboard?.writeText) {
      clipboard
        .writeText(text)
        .then(() => this.notifications.info('Commands copied to clipboard.', 'AI Agent'))
        .catch(() => this.notifications.error('Clipboard copy failed.', 'AI Agent'))
      return
    }
    this.notifications.error('Clipboard API not available.', 'AI Agent')
  }

  trackMessage(_: number, msg: ChatMessage): string {
    return msg.id
  }

  private refreshConfig(): void {
    this.config = this.agent.getConfig()
  }

  private refreshTarget(): void {
    const tab = this.agent.getTargetTab()
    if (!tab) {
      this.targetTabName = 'No terminal selected'
      this.targetTabId = null
      this.deviceType = 'unknown'
      return
    }
    this.targetTabId = this.agent.getTargetTabId()
    const profileName = (tab.profile as any)?.name ?? ''
    const tabTitle = tab.title || tab.customTitle || 'Terminal'
    this.targetTabName = profileName ? `${tabTitle} (${profileName})` : tabTitle
    const context = this.agent.getContextForTab(tab)
    this.deviceType = context.deviceType
  }

  private addMessage(role: MessageRole, text: string, plan?: AgentPlan, warning?: string): void {
    const id = `${Date.now()}-${Math.round(Math.random() * 10000)}`
    this.messages.push({ id, role, text, plan, warning })
  }

  private replacePlan(updatedPlan: AgentPlan): void {
    const target = this.messages.find((msg) => msg.plan?.id === updatedPlan.id)
    if (target && target.plan) {
      target.plan = updatedPlan
    }
  }
}
