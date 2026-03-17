import { Component, OnInit } from '@angular/core'
import { ConfigService, NotificationsService } from 'tabby-core'
import { AiNetworkAgentConfig, AI_NETWORK_AGENT_CONFIG_KEY, DEFAULT_CONFIG } from '../config'
import template from './agent-settings.component.html'
import styles from './agent-settings.component.scss'

@Component({
  selector: 'ai-network-agent-settings',
  template,
  styles: [styles],
})
export class AgentSettingsComponent implements OnInit {
  config: AiNetworkAgentConfig = { ...DEFAULT_CONFIG }
  isSaving = false

  constructor(
    private configService: ConfigService,
    private notifications: NotificationsService,
  ) {}

  ngOnInit(): void {
    this.load()
  }

  load(): void {
    // Read from Tabby's config store, merge with defaults for any missing fields
    const stored = this.configService.store[AI_NETWORK_AGENT_CONFIG_KEY] || {}
    this.config = { ...DEFAULT_CONFIG }
    // Override defaults with saved values (only non-undefined)
    for (const key of Object.keys(stored)) {
      if ((stored as any)[key] !== undefined) {
        (this.config as any)[key] = (stored as any)[key]
      }
    }
  }

  async save(): Promise<void> {
    this.isSaving = true
    // Save the full config object directly
    this.configService.store[AI_NETWORK_AGENT_CONFIG_KEY] = { ...this.config }
    this.configService.save()
    this.isSaving = false
    this.notifications.info('设置已保存')
  }

  resetDefaults(): void {
    this.config = { ...DEFAULT_CONFIG }
  }
}
