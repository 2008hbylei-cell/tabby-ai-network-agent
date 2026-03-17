import { Subscription } from 'rxjs'
import { DeviceType } from '../device-map'

export class TerminalContext {
  readonly tabId: string
  readonly lines: string[] = []
  private remainder = ''
  deviceType: DeviceType = 'unknown'
  lastPlanId: string | null = null
  subscription: Subscription | null = null

  constructor(tabId: string) {
    this.tabId = tabId
  }

  appendOutput(chunk: string, maxLines: number): void {
    if (!chunk) return
    const combined = this.remainder + chunk
    const parts = combined.split(/\r?\n/)
    this.remainder = parts.pop() ?? ''
    for (const line of parts) {
      if (line === '') continue
      this.lines.push(line)
    }
    if (this.lines.length > maxLines) {
      this.lines.splice(0, this.lines.length - maxLines)
    }
  }

  getRecentText(maxLines: number): string {
    if (this.lines.length <= maxLines) {
      return this.lines.join('\n')
    }
    return this.lines.slice(-maxLines).join('\n')
  }
}

