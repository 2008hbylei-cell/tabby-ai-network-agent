import { Injectable } from '@angular/core'
import { ConfigProvider } from 'tabby-core'
import { AI_NETWORK_AGENT_CONFIG_KEY } from '../config'

@Injectable()
export class AgentConfigProvider extends ConfigProvider {
  defaults = {
    [AI_NETWORK_AGENT_CONFIG_KEY]: {},
  }
}
