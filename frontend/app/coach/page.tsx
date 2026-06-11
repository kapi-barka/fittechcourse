/**
 * Страница AI-тренера — чат с персональным контекстом пользователя.
 * Стриминг ответа реализован через fetch + ReadableStream (SSE).
 */
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { AuthGuard } from '@/components/AuthGuard'
import { coachAPI } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import { Send, Trash2, Bot, User, Loader2, Sparkles, Dumbbell, Utensils, TrendingUp, Zap } from 'lucide-react'
import { toast } from 'react-toastify'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

const QUICK_PROMPTS = [
  { icon: TrendingUp, text: 'Как мой прогресс за последний месяц?' },
  { icon: Utensils,   text: 'Что я ел вчера?' },
  { icon: Dumbbell,   text: 'Дай лёгкую тренировку на сегодня' },
  { icon: Zap,        text: 'Почему у меня не растут показатели?' },
]

/** Конвертирует markdown-like текст в JSX без внешних зависимостей */
function renderContent(text: string) {
  return text.split('\n').filter(l => l.trim() !== '').map((line, i) => {
    // Убираем markdown-символы и рендерим как текст
    const clean = line
      .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold** → plain
      .replace(/\*(.+?)\*/g,   '$1')     // *italic* → plain
      .replace(/^#{1,3}\s+/,   '')       // ## Header → plain
      .replace(/^[-•]\s+/,     '→ ')    // - item → → item

    const isHighlight = /^→/.test(clean)
    return (
      <p key={i} className={cn(i > 0 && 'mt-1.5', isHighlight && 'pl-2 border-l-2 border-primary/40')}>
        {clean}
      </p>
    )
  })
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'

  return (
    <div className={cn('flex gap-3 items-start', isUser && 'flex-row-reverse')}>
      {/* Аватар */}
      <div className={cn(
        'shrink-0 flex items-center justify-center w-8 h-8 rounded-full',
        isUser
          ? 'bg-primary text-primary-foreground'
          : 'bg-gradient-to-br from-violet-500 to-purple-700 text-white',
      )}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Текст */}
      <div className={cn(
        'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
        isUser
          ? 'bg-primary text-primary-foreground rounded-tr-sm'
          : 'bg-card border border-white/8 text-foreground rounded-tl-sm',
      )}>
        {isUser
          ? <p>{msg.content}</p>
          : renderContent(msg.content)
        }
        {msg.streaming && (
          <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5 align-text-bottom" />
        )}
      </div>
    </div>
  )
}

export default function CoachPage() {
  useAuthStore() // ensure store is initialised
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const messagesRef  = useRef<HTMLDivElement>(null)
  const textareaRef  = useRef<HTMLTextAreaElement>(null)

  // Блокируем скролл страницы — чат сам управляет своим скроллом
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Загрузка истории
  useEffect(() => {
    coachAPI.getHistory()
      .then(res => {
        const history = res.data.map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
        setMessages(history)
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [])

  // Автоскролл вниз — только внутри контейнера сообщений
  useEffect(() => {
    const el = messagesRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return
    setInput('')

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
    }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    const assistantId = `assistant-${Date.now()}`
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      streaming: true,
    }])

    try {
      const response = await fetch(`${API_URL}/coach/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('access_token') : ''}`,
        },
        body: JSON.stringify({ message: text.trim() }),
      })

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''   // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const dataStr = line.slice(5).trim()
          if (!dataStr) continue

          let event: { type: string; text?: string }
          try { event = JSON.parse(dataStr) } catch { continue }

          if (event.type === 'chunk' && event.text) {
            setMessages(prev => prev.map(m =>
              m.id === assistantId
                ? { ...m, content: m.content + event.text }
                : m
            ))
          } else if (event.type === 'done') {
            setMessages(prev => prev.map(m =>
              m.id === assistantId ? { ...m, streaming: false } : m
            ))
          } else if (event.type === 'error') {
            setMessages(prev => prev.map(m =>
              m.id === assistantId
                ? { ...m, content: event.text || 'Ошибка', streaming: false }
                : m
            ))
          }
        }
      }
    } catch (err) {
      console.error('Coach stream error:', err)
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: 'Не удалось получить ответ. Проверьте соединение.', streaming: false }
          : m
      ))
    } finally {
      setIsLoading(false)
    }
  }, [isLoading])

  const handleClearHistory = async () => {
    try {
      await coachAPI.clearHistory()
      setMessages([])
      toast.success('История чата очищена')
    } catch {
      toast.error('Не удалось очистить историю')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  // Авторесайз textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }

  const isEmpty = messages.length === 0 && !historyLoading

  return (
    <AuthGuard>
      <div className="flex flex-col h-[calc(100vh-4rem)] max-w-3xl mx-auto w-full overflow-hidden">

        {/* ── Header ─────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-700">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-none">Консультант</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Знает ваши данные и цели</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Очистить
            </button>
          )}
        </div>

        {/* ── Messages ───────────────────────────── */}
        <div ref={messagesRef} className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 space-y-5 min-h-full flex flex-col">

            {historyLoading && (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Приветствие, если история пуста */}
            {isEmpty && (
              <div className="flex flex-col items-center gap-6 py-10 text-center m-auto">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 shadow-lg">
                  <Bot className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Привет! Я ваш консультант</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                    Знаю ваши тренировки, питание и цели — спросите о чём угодно.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
                  {QUICK_PROMPTS.map(({ icon: Icon, text }) => (
                    <button
                      key={text}
                      onClick={() => sendMessage(text)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/8 bg-card/60 hover:bg-card text-left text-sm transition-colors group"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                      <span className="text-muted-foreground group-hover:text-foreground transition-colors">{text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Сообщения — прижаты к низу */}
            <div className="mt-auto space-y-5">
              {messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
            </div>

            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── Input ──────────────────────────────── */}
        <div className="shrink-0 border-t border-white/8 bg-background px-4 py-3">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Спросите что-нибудь... (Enter — отправить, Shift+Enter — перенос)"
                disabled={isLoading}
                className={cn(
                  'w-full resize-none rounded-2xl border border-white/10 bg-white/5',
                  'px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground',
                  'focus:outline-none focus:ring-1 focus:ring-primary/50',
                  'disabled:opacity-50 transition-all overflow-hidden',
                )}
                style={{ minHeight: '44px', maxHeight: '140px' }}
              />
            </div>
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className={cn(
                'shrink-0 flex items-center justify-center w-11 h-11 rounded-2xl transition-all',
                'bg-primary text-primary-foreground',
                'hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              {isLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />
              }
            </button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground mt-2">
            AI может ошибаться. Консультируйтесь со специалистом по медицинским вопросам.
          </p>
        </div>

      </div>
    </AuthGuard>
  )
}
