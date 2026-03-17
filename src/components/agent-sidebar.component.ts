import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core'
import { AppService, NotificationsService } from 'tabby-core'
import { Subscription } from 'rxjs'
import { AgentService, AgentStep } from '../agent/agent.service'
import { SidebarService } from '../services/sidebar.service'

interface ChatMessage {
  id: string
  role: 'user' | 'ai' | 'status'
  text: string
  type?: 'thinking' | 'executing' | 'output' | 'answer' | 'error'
}

@Component({
  selector: 'ai-network-agent-sidebar',
  template: `
<div class="sidebar-root">
  <div class="sidebar-header">
    <div class="sidebar-title">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 640 512">
        <path d="M32 224h32v192H32a32 32 0 0 1-32-32V256a32 32 0 0 1 32-32zm512-48v272a64 64 0 0 1-64 64H160a64 64 0 0 1-64-64V176a79.974 79.974 0 0 1 80-80h112V56a24 24 0 0 1 48 0v40h112a79.974 79.974 0 0 1 80 80zm-280 80a40 40 0 1 0-40 40 40.045 40.045 0 0 0 40-40zm160 0a40 40 0 1 0-40 40 40.045 40.045 0 0 0 40-40zm-48 136H264a12 12 0 0 0-12 12 52.06 52.06 0 0 0 52 52h32a52.06 52.06 0 0 0 52-52 12 12 0 0 0-12-12zm176-168H576v192h32a32 32 0 0 0 32-32V256a32 32 0 0 0-32-32z"/>
      </svg>
      <span>AI 网络助手</span>
    </div>
    <div class="header-actions">
      <button class="icon-btn" (click)="clearChat()" title="清空对话">🗑</button>
      <button class="icon-btn" (click)="closeSidebar()" title="关闭侧边栏">✕</button>
    </div>
  </div>

  <div class="sidebar-status">
    <span class="chip" [class.chip-ok]="targetTabName !== '未选择终端'">{{ targetTabName }}</span>
  </div>

  <div class="sidebar-messages" #messageList>
    <div *ngIf="messages.length === 0" class="empty-hint">
      <div class="empty-icon">🤖</div>
      <div class="empty-title">你好！我是 AI 网络助手</div>
      <div class="empty-sub">告诉我你想做什么，我会自动执行命令并为你分析结果。</div>
      <div class="empty-examples">
        <div class="example" (click)="quickSend('查看设备版本信息')">📋 查看设备版本信息</div>
        <div class="example" (click)="quickSend('检查所有接口状态')">🔌 检查所有接口状态</div>
        <div class="example" (click)="quickSend('查看路由表')">🛤 查看路由表</div>
        <div class="example" (click)="quickSend('查看当前运行配置')">⚙ 查看当前运行配置</div>
      </div>
    </div>

    <div *ngFor="let msg of messages; trackBy: trackMsg" class="msg" [ngClass]="getMsgClass(msg)">

      <!-- User message -->
      <ng-container *ngIf="msg.role === 'user'">
        <div class="msg-label">我</div>
        <div class="msg-text">{{ msg.text }}</div>
      </ng-container>

      <!-- AI thinking -->
      <ng-container *ngIf="msg.role === 'status' && msg.type === 'thinking'">
        <div class="msg-label">💭 思考中</div>
        <div class="msg-text dim">{{ msg.text }}</div>
      </ng-container>

      <!-- AI executing -->
      <ng-container *ngIf="msg.role === 'status' && msg.type === 'executing'">
        <div class="msg-label">⚡ 正在执行</div>
        <div class="msg-cmd">{{ msg.text }}</div>
      </ng-container>

      <!-- Terminal output -->
      <ng-container *ngIf="msg.role === 'status' && msg.type === 'output'">
        <div class="msg-label">📟 终端输出</div>
        <div class="msg-terminal">{{ msg.text }}</div>
      </ng-container>

      <!-- AI final answer -->
      <ng-container *ngIf="msg.role === 'ai' && msg.type === 'answer'">
        <div class="msg-label">🤖 AI</div>
        <div class="msg-text">{{ msg.text }}</div>
      </ng-container>

      <!-- Error -->
      <ng-container *ngIf="msg.type === 'error'">
        <div class="msg-label">❌ 错误</div>
        <div class="msg-text error-text">{{ msg.text }}</div>
      </ng-container>

    </div>

    <!-- Busy indicator -->
    <div *ngIf="isBusy" class="busy-indicator">
      <div class="dot-pulse"></div>
      <span>正在处理中…</span>
    </div>
  </div>

  <div class="sidebar-input">
    <textarea
      [(ngModel)]="inputText"
      class="input-box"
      placeholder="描述你的需求，如「查看接口状态」…"
      [disabled]="isBusy"
      (keydown.enter)="onEnter($event)"
      rows="1"
    ></textarea>
    <button class="send-btn" (click)="send()" [disabled]="isBusy || !inputText.trim()">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576 6.636 10.07Zm6.787-8.201L1.591 6.602l4.339 2.76 7.494-7.493Z"/>
      </svg>
    </button>
  </div>
</div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }

    .sidebar-root {
      display: flex; flex-direction: column; height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: var(--bs-body-color, #e6e6e6);
      font-size: 13px;
    }

    .sidebar-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,.08);
      flex-shrink: 0;
    }
    .sidebar-title { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; }
    .header-actions { display: flex; gap: 2px; }
    .icon-btn {
      border: none; background: none; color: inherit; font-size: 14px;
      cursor: pointer; opacity: .5; padding: 4px 6px; border-radius: 4px;
    }
    .icon-btn:hover { opacity: 1; background: rgba(255,255,255,.1); }

    .sidebar-status { padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,.06); flex-shrink: 0; }
    .chip {
      padding: 3px 10px; border-radius: 999px; font-size: 11px;
      background: rgba(255,255,255,.06); display: inline-block;
    }
    .chip-ok { background: rgba(56,200,100,.15); color: #5ad47c; }

    .sidebar-messages {
      flex: 1; overflow-y: auto; padding: 12px;
      display: flex; flex-direction: column; gap: 8px;
    }

    .empty-hint { margin: auto; text-align: center; padding: 20px 8px; }
    .empty-icon { font-size: 36px; margin-bottom: 8px; }
    .empty-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
    .empty-sub { font-size: 12px; opacity: .6; margin-bottom: 16px; }
    .empty-examples { display: flex; flex-direction: column; gap: 6px; }
    .example {
      padding: 8px 12px; border-radius: 8px; font-size: 12px;
      background: rgba(255,255,255,.06); cursor: pointer; text-align: left;
      border: 1px solid rgba(255,255,255,.08); transition: all .15s;
    }
    .example:hover { background: rgba(56,130,255,.15); border-color: rgba(56,130,255,.3); }

    .msg { padding: 8px 10px; border-radius: 10px; animation: fadeIn .15s ease-out; }
    .msg-user { background: rgba(56,130,255,.12); border: 1px solid rgba(56,130,255,.2); }
    .msg-thinking { background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06); }
    .msg-executing { background: rgba(255,170,0,.08); border: 1px solid rgba(255,170,0,.2); }
    .msg-output { background: rgba(0,0,0,.35); border: 1px solid rgba(255,255,255,.08); }
    .msg-answer { background: rgba(56,200,100,.08); border: 1px solid rgba(56,200,100,.2); }
    .msg-error { background: rgba(255,60,60,.1); border: 1px solid rgba(255,60,60,.25); }

    .msg-label { font-size: 10px; font-weight: 600; opacity: .6; margin-bottom: 3px; text-transform: uppercase; letter-spacing: .04em; }
    .msg-text { line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
    .msg-text.dim { opacity: .7; font-style: italic; }
    .error-text { color: #ff6b6b; }

    .msg-cmd {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px; padding: 6px 8px; border-radius: 6px;
      background: rgba(0,0,0,.3); color: #ffb347;
    }
    .msg-terminal {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px; line-height: 1.35; white-space: pre-wrap; word-break: break-all;
      max-height: 200px; overflow-y: auto;
      padding: 6px 8px; border-radius: 6px;
      background: rgba(0,0,0,.25); color: #aaa;
    }

    .busy-indicator {
      display: flex; align-items: center; gap: 8px;
      padding: 10px; font-size: 12px; opacity: .7;
    }
    .dot-pulse {
      width: 6px; height: 6px; border-radius: 50%;
      background: #4dabf7;
      animation: pulse 1s infinite;
    }

    .sidebar-input {
      border-top: 1px solid rgba(255,255,255,.08);
      padding: 8px 10px 10px; display: flex; gap: 8px; align-items: flex-end;
      flex-shrink: 0;
    }
    .input-box {
      flex: 1; min-height: 38px; max-height: 100px; resize: vertical;
      border-radius: 8px; border: 1px solid rgba(255,255,255,.12);
      background: rgba(0,0,0,.3); color: inherit; padding: 8px 10px;
      font-size: 13px; font-family: inherit; line-height: 1.4;
    }
    .send-btn {
      flex-shrink: 0; width: 36px; height: 36px;
      border-radius: 8px; border: none;
      background: rgba(56,130,255,.7); color: #fff;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: background .15s;
    }
    .send-btn:disabled { opacity: .35; cursor: not-allowed; }
    .send-btn:hover:not(:disabled) { background: rgba(56,130,255,.95); }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulse {
      0%, 100% { opacity: .4; transform: scale(.8); }
      50% { opacity: 1; transform: scale(1.2); }
    }
  `],
})
export class AgentSidebarComponent implements OnInit, OnDestroy {
  sidebarService!: SidebarService

  messages: ChatMessage[] = []
  inputText = ''
  isBusy = false
  targetTabName = '未选择终端'

  @ViewChild('messageList') messageListRef!: ElementRef

  private subs: Subscription[] = []

  constructor(
    private app: AppService,
    private agent: AgentService,
  ) {}

  ngOnInit(): void {
    this.refreshTarget()
    this.subs.push(
      this.app.activeTabChange$.subscribe(() => this.refreshTarget()),
    )
  }

  ngOnDestroy(): void {
    for (const sub of this.subs) sub.unsubscribe()
  }

  closeSidebar(): void { this.sidebarService?.hide() }

  clearChat(): void {
    this.messages = []
    const tab = this.agent.getTargetTab()
    if (tab) {
      this.agent.clearMemory(tab)
    }
  }

  quickSend(text: string): void {
    this.inputText = text
    this.send()
  }

  onEnter(e: Event): void {
    if ((e as KeyboardEvent).shiftKey) return
    e.preventDefault()
    this.send()
  }

  async send(): Promise<void> {
    const text = this.inputText.trim()
    if (!text || this.isBusy) return

    this.addMsg('user', text)
    this.inputText = ''
    this.isBusy = true
    this.refreshTarget()

    try {
      await this.agent.runAgent(text, (step: AgentStep) => {
        switch (step.type) {
          case 'thinking':
            this.addMsg('status', step.text, 'thinking')
            break
          case 'executing':
            this.addMsg('status', step.text, 'executing')
            break
          case 'output':
            this.addMsg('status', step.text, 'output')
            break
          case 'answer':
            this.addMsg('ai', step.text, 'answer')
            break
          case 'error':
            this.addMsg('status', step.text, 'error')
            break
        }
        this.scrollToBottom()
      })
    } catch (err) {
      this.addMsg('status', err instanceof Error ? err.message : '发生未知错误', 'error')
    } finally {
      this.isBusy = false
      this.scrollToBottom()
    }
  }

  trackMsg(_: number, msg: ChatMessage): string { return msg.id }

  getMsgClass(msg: ChatMessage): string {
    if (msg.role === 'user') return 'msg-user'
    if (msg.type === 'thinking') return 'msg-thinking'
    if (msg.type === 'executing') return 'msg-executing'
    if (msg.type === 'output') return 'msg-output'
    if (msg.type === 'answer') return 'msg-answer'
    if (msg.type === 'error') return 'msg-error'
    return ''
  }

  private refreshTarget(): void {
    this.agent.captureActiveTerminalTab()
    this.targetTabName = this.agent.getTargetTabName()
  }

  private addMsg(role: 'user' | 'ai' | 'status', text: string, type?: string): void {
    this.messages.push({
      id: `${Date.now()}-${Math.round(Math.random() * 10000)}`,
      role,
      text,
      type: type as any,
    })
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.messageListRef?.nativeElement
      if (el) el.scrollTop = el.scrollHeight
    }, 50)
  }
}
