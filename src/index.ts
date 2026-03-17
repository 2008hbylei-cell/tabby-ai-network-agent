import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import TabbyCoreModule, { ConfigProvider, ToolbarButtonProvider, AppService } from 'tabby-core'
import { SettingsTabProvider } from 'tabby-settings'

import { AgentSidebarComponent } from './components/agent-sidebar.component'
import { AgentSettingsComponent } from './components/agent-settings.component'
import { AgentService } from './agent/agent.service'
import { SidebarService } from './services/sidebar.service'
import { AgentConfigProvider } from './providers/agent-config.provider'
import { AgentSettingsTabProvider } from './providers/agent-settings-tab.provider'
import { AgentToolbarButtonProvider } from './providers/agent-toolbar.provider'

@NgModule({
  imports: [CommonModule, FormsModule, TabbyCoreModule],
  declarations: [AgentSidebarComponent, AgentSettingsComponent],
  entryComponents: [AgentSidebarComponent, AgentSettingsComponent],
  providers: [
    AgentService,
    SidebarService,
    { provide: ConfigProvider, useClass: AgentConfigProvider, multi: true },
    { provide: SettingsTabProvider, useClass: AgentSettingsTabProvider, multi: true },
    { provide: ToolbarButtonProvider, useClass: AgentToolbarButtonProvider, multi: true },
  ],
})
export default class AiNetworkAgentModule {
  constructor(
    private sidebar: SidebarService,
  ) {
    // Restore sidebar visibility from persisted config
    setTimeout(() => this.sidebar.initialize(), 500)
  }
}
