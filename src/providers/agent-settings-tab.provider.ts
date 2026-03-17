import { Injectable } from '@angular/core'
import { SettingsTabProvider } from 'tabby-settings'
import { AgentSettingsComponent } from '../components/agent-settings.component'

@Injectable()
export class AgentSettingsTabProvider extends SettingsTabProvider {
  id = 'ai-network-agent'
  icon = 'robot'
  title = 'AI 网络助手'
  weight = 50

  getComponentType(): any {
    return AgentSettingsComponent
  }
}
