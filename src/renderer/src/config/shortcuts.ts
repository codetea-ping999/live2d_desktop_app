/**
 * ショートカット設定（アプリ起動・定型文）
 * 必要に応じて編集してください。将来は設定ファイルから読み込むことも可能です。
 */

export interface AppShortcut {
  id: string
  label: string
  /** macOS: アプリ名（例: "Mail", "Slack"）。Windows: 実行ファイルパス */
  appNameOrPath: string
  icon?: string
}

export interface TemplateShortcut {
  id: string
  label: string
  text: string
  icon?: string
}

/** ワンクリックで起動するアプリ（表示名と macOS のアプリ名） */
export const defaultAppShortcuts: AppShortcut[] = [
  { id: 'mail', label: 'Mail', appNameOrPath: 'Mail', icon: '✉️' },
  { id: 'slack', label: 'Slack', appNameOrPath: 'Slack', icon: '💬' },
  { id: 'notes', label: 'Notes', appNameOrPath: 'Notes', icon: '📝' },
  { id: 'terminal', label: 'Terminal', appNameOrPath: 'Terminal', icon: '⌨️' },
  { id: 'cursor', label: 'Cursor', appNameOrPath: 'Cursor', icon: '🖥️' }
]

/** クリックでクリップボードにコピーする定型文 */
export const defaultTemplateShortcuts: TemplateShortcut[] = [
  {
    id: 'email-greeting',
    label: 'メール挨拶',
    text: 'お疲れ様です。\n\n',
    icon: '✉️'
  },
  {
    id: 'email-end',
    label: 'メール結び',
    text: 'よろしくお願いいたします。',
    icon: '📧'
  },
  {
    id: 'chat-quick',
    label: 'チャット定型',
    text: '了解しました。よろしくお願いします。',
    icon: '💬'
  },
  {
    id: 'prompt-summary',
    label: 'プロンプト要約',
    text: '上記の内容を簡潔に要約してください。',
    icon: '📋'
  },
  {
    id: 'prompt-en',
    label: 'プロンプト英訳',
    text: '上記の日本語を自然な英語に翻訳してください。',
    icon: '🌐'
  }
]
