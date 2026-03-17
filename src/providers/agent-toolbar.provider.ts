import { Injectable } from '@angular/core'
import { ToolbarButtonProvider, ToolbarButton } from 'tabby-core'
import { SidebarService } from '../services/sidebar.service'

const ROBOT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" fill="currentColor"><path d="M32 224h32v192H32a32 32 0 0 1-32-32V256a32 32 0 0 1 32-32zm512-48v272a64 64 0 0 1-64 64H160a64 64 0 0 1-64-64V176a79.974 79.974 0 0 1 80-80h112V56a24 24 0 0 1 48 0v40h112a79.974 79.974 0 0 1 80 80zm-280 80a40 40 0 1 0-40 40 40.045 40.045 0 0 0 40-40zm160 0a40 40 0 1 0-40 40 40.045 40.045 0 0 0 40-40zm-48 136H264a12 12 0 0 0-12 12 52.06 52.06 0 0 0 52 52h32a52.06 52.06 0 0 0 52-52 12 12 0 0 0-12-12zm176-168H576v192h32a32 32 0 0 0 32-32V256a32 32 0 0 0-32-32z"/></svg>`

@Injectable()
export class AgentToolbarButtonProvider extends ToolbarButtonProvider {
  constructor(private sidebar: SidebarService) {
    super()
  }

  provide(): ToolbarButton[] {
    return [
      {
        icon: ROBOT_SVG,
        title: 'AI 网络助手',
        weight: 10,
        click: () => this.sidebar.toggle(),
      },
    ]
  }
}
