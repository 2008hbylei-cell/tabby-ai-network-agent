import {
  Injectable,
  ApplicationRef,
  Injector,
  EnvironmentInjector,
  EmbeddedViewRef,
  ComponentRef,
  createComponent,
} from '@angular/core'
import { ConfigService } from 'tabby-core'
import { AgentSidebarComponent } from '../components/agent-sidebar.component'
import { AI_NETWORK_AGENT_CONFIG_KEY } from '../config'

@Injectable({ providedIn: 'root' })
export class SidebarService {
  private sidebarRef: ComponentRef<AgentSidebarComponent> | null = null
  private wrapperEl: HTMLElement | null = null
  private styleEl: HTMLStyleElement | null = null
  private _visible = false

  private readonly MIN_W = 280
  private readonly MAX_W = 500
  private readonly DEFAULT_W = 340
  private currentW = this.DEFAULT_W
  private resizing = false

  get visible(): boolean {
    return this._visible
  }

  constructor(
    private appRef: ApplicationRef,
    private injector: Injector,
    private envInjector: EnvironmentInjector,
    private config: ConfigService,
  ) {}

  /** Toggle sidebar visibility */
  toggle(): void {
    this._visible ? this.hide() : this.show()
  }

  show(): void {
    if (this._visible) return
    this.create()
    this._visible = true
    this.savePref('sidebarVisible', true)
  }

  hide(): void {
    if (!this._visible) return
    this.destroy()
    this._visible = false
    this.savePref('sidebarVisible', false)
  }

  /** Called once on module construction to restore previous state */
  initialize(): void {
    const prefs = this.getPrefs()
    if (prefs.sidebarVisible) {
      this.show()
    }
  }

  // ───────── Private helpers ─────────

  private create(): void {
    // Dynamically create the sidebar Angular component
    this.sidebarRef = createComponent(AgentSidebarComponent, {
      environmentInjector: this.envInjector,
      elementInjector: this.injector,
    })
    this.appRef.attachView(this.sidebarRef.hostView)

    const componentEl = (this.sidebarRef.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement
    componentEl.style.cssText = 'display:flex;flex-direction:column;height:100%;width:100%;overflow:hidden;'

    // Load persisted width
    this.currentW = this.loadWidth()

    // Create wrapper with fixed positioning
    const wrapper = document.createElement('div')
    wrapper.className = 'ai-agent-sidebar-wrapper'
    wrapper.style.cssText = `
      position: fixed;
      left: 0;
      top: 0;
      width: ${this.currentW}px;
      height: ${window.innerHeight}px;
      display: flex;
      flex-direction: column;
      background: var(--bs-body-bg, #1e1e1e);
      border-right: 1px solid var(--bs-border-color, #333);
      box-shadow: 2px 0 12px rgba(0,0,0,0.35);
      z-index: 1000;
      overflow: hidden;
    `

    // Keep height in sync with viewport
    const onResize = () => { wrapper.style.height = `${window.innerHeight}px` }
    window.addEventListener('resize', onResize)
    ;(wrapper as any)._rh = onResize

    // Resize drag-handle
    const handle = document.createElement('div')
    handle.style.cssText = `
      position: absolute;
      top: 0; right: -4px;
      width: 8px; height: 100%;
      cursor: ew-resize;
      background: transparent;
      z-index: 1001;
      transition: background 0.15s;
    `
    handle.addEventListener('mouseenter', () => { handle.style.background = 'rgba(77,171,247,.6)' })
    handle.addEventListener('mouseleave', () => { if (!this.resizing) handle.style.background = 'transparent' })
    this.initResize(handle, wrapper)
    wrapper.appendChild(handle)

    wrapper.appendChild(componentEl)
    document.body.appendChild(wrapper)
    this.wrapperEl = wrapper

    // Inject CSS to push main content right
    this.injectCSS()

    // Give component a reference to this service so it can call hide()
    this.sidebarRef.instance.sidebarService = this
  }

  private destroy(): void {
    this.removeCSS()

    if (this.wrapperEl) {
      const handler = (this.wrapperEl as any)._rh
      if (handler) window.removeEventListener('resize', handler)
    }
    if (this.sidebarRef) {
      this.appRef.detachView(this.sidebarRef.hostView)
      this.sidebarRef.destroy()
      this.sidebarRef = null
    }
    if (this.wrapperEl) {
      this.wrapperEl.remove()
      this.wrapperEl = null
    }
  }

  // ── Layout CSS ──

  private injectCSS(): void {
    const s = document.createElement('style')
    s.id = 'ai-agent-sidebar-css'
    s.textContent = this.buildCSS(this.currentW)
    document.head.appendChild(s)
    this.styleEl = s
    this.pushMainContent(true)
  }

  private removeCSS(): void {
    this.styleEl?.remove()
    this.styleEl = null
    this.pushMainContent(false)
  }

  private updateCSS(w: number): void {
    if (this.styleEl) this.styleEl.textContent = this.buildCSS(w)
    this.pushMainContent(true)
  }

  private buildCSS(w: number): string {
    return `
      app-root > .content,
      app-root > app-title-bar + .content,
      app-root > .tab-bar + .content,
      body > app-root > .content {
        margin-left: ${w}px !important;
      }
      app-root > .tab-bar,
      app-root > app-title-bar,
      app-root > .title-bar { margin-left: 0 !important; }
      app-root { position: relative; }
    `
  }

  private pushMainContent(apply: boolean): void {
    const root = document.querySelector('app-root')
    if (!root) return
    for (const child of Array.from(root.children)) {
      const cl = child.className || ''
      const tag = child.tagName.toLowerCase()
      if (tag.includes('tab') || tag.includes('title') || cl.includes('tab') || cl.includes('title')) continue
      const el = child as HTMLElement
      if (apply) {
        el.style.marginLeft = `${this.currentW}px`
        el.style.transition = 'margin-left 0.2s ease'
      } else {
        el.style.marginLeft = ''
        el.style.transition = ''
      }
    }
  }

  // ── Resize logic ──

  private initResize(handle: HTMLElement, wrapper: HTMLElement): void {
    let startX = 0
    let startW = 0

    const onMove = (e: MouseEvent) => {
      if (!this.resizing) return
      const newW = Math.max(this.MIN_W, Math.min(this.MAX_W, startW + (e.clientX - startX)))
      this.currentW = newW
      wrapper.style.width = `${newW}px`
      this.updateCSS(newW)
    }

    const onUp = () => {
      this.resizing = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      handle.style.background = 'transparent'
      this.saveWidth(this.currentW)
    }

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault()
      this.resizing = true
      startX = e.clientX
      startW = this.currentW
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
    })
  }

  // ── Persistence ──

  private getPrefs(): any {
    return this.config.store[AI_NETWORK_AGENT_CONFIG_KEY]?.sidebar || {}
  }

  private savePref(key: string, value: any): void {
    const cfg = this.config.store[AI_NETWORK_AGENT_CONFIG_KEY] || {}
    cfg.sidebar = cfg.sidebar || {}
    cfg.sidebar[key] = value
    this.config.store[AI_NETWORK_AGENT_CONFIG_KEY] = cfg
    this.config.save()
  }

  private loadWidth(): number {
    const w = this.getPrefs().width
    return w && w >= this.MIN_W && w <= this.MAX_W ? w : this.DEFAULT_W
  }

  private saveWidth(w: number): void {
    this.savePref('width', w)
  }
}
