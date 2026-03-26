/**
 * Админ-панель для управления пользователями и контентом
 */
'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { AuthGuard } from '@/components/AuthGuard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { usersAPI, exercisesAPI, articlesAPI, User, Exercise, Article } from '@/lib/api'
import {
  Users,
  Dumbbell,
  UserCheck,
  UserX,
  Plus,
  Trash2,
  Edit,
  BookOpen,
  ShieldCheck,
  Search,
  Loader2,
  Eye,
  FileText,
  Tag,
  Calendar,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { translateMuscleGroup } from '@/lib/muscleGroups'
import { Modal } from '@/components/ui/Modal'
import { ExerciseForm } from '@/components/admin/ExerciseForm'
import { ArticleForm } from '@/components/admin/ArticleForm'
import { toast } from 'react-toastify'
import { cn } from '@/lib/utils'

// ── User initials avatar ─────────────────────────────────────────────────────
function UserAvatar({ name, email }: { name?: string | null; email: string }) {
  const letters = name
    ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : email[0].toUpperCase()
  return (
    <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold shrink-0">
      {letters}
    </div>
  )
}

// ── Role badge ───────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const cls =
    role === 'admin'
      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
      : role === 'user'
      ? 'bg-primary/15 text-primary border-primary/30'
      : 'bg-white/5 text-muted-foreground border-white/10'
  return (
    <span className={cn('text-[11px] px-2 py-0.5 rounded-full border font-medium', cls)}>
      {role}
    </span>
  )
}

export default function AdminPage() {
  const { user: currentUser } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'users' | 'exercises' | 'articles'>('users')
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setSearchQuery('')
    if (activeTab === 'users') fetchUsers()
    else if (activeTab === 'exercises') fetchExercises()
    else if (activeTab === 'articles') fetchArticles()
  }, [activeTab])

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const res = await usersAPI.listUsers()
      setUsers(res.data)
    } catch (error) {
      console.error('Error fetching users:', error)
    }
    setIsLoading(false)
  }

  const fetchExercises = async () => {
    setIsLoading(true)
    try {
      const res = await exercisesAPI.list()
      setExercises(res.data)
    } catch (error) {
      console.error('Error fetching exercises:', error)
    }
    setIsLoading(false)
  }

  const fetchArticles = async () => {
    setIsLoading(true)
    try {
      const res = await articlesAPI.list({ published_only: false })
      setArticles(res.data)
    } catch (error) {
      console.error('Error fetching articles:', error)
    }
    setIsLoading(false)
  }

  const handleBlockUser = async (userId: string) => {
    try {
      await usersAPI.blockUser(userId)
      fetchUsers()
      toast.success('Пользователь заблокирован')
    } catch {
      toast.error('Ошибка при блокировке')
    }
  }

  const handleUnblockUser = async (userId: string) => {
    try {
      await usersAPI.unblockUser(userId)
      fetchUsers()
      toast.success('Пользователь разблокирован')
    } catch {
      toast.error('Ошибка при разблокировке')
    }
  }

  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false)
  const [editingExercise, setEditingExercise] = useState<Exercise | undefined>(undefined)

  const handleCreateExerciseClick = () => {
    setEditingExercise(undefined)
    setIsExerciseModalOpen(true)
  }

  const handleEditExerciseClick = (exercise: Exercise) => {
    setEditingExercise(exercise)
    setIsExerciseModalOpen(true)
  }

  const handleExerciseSubmit = async (data: Partial<Exercise>) => {
    try {
      if (editingExercise) {
        await exercisesAPI.update(editingExercise.id, data)
      } else {
        await exercisesAPI.create(data)
      }
      setIsExerciseModalOpen(false)
      fetchExercises()
      toast.success('Упражнение успешно сохранено')
    } catch {
      toast.error('Ошибка при сохранении упражнения')
    }
  }

  const handleDeleteExercise = async (exerciseId: string) => {
    if (confirm('Удалить упражнение?')) {
      try {
        await exercisesAPI.delete(exerciseId)
        fetchExercises()
        toast.success('Упражнение удалено')
      } catch {
        toast.error('Ошибка при удалении упражнения')
      }
    }
  }

  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false)
  const [editingArticle, setEditingArticle] = useState<Article | undefined>(undefined)

  const handleCreateArticleClick = () => {
    setEditingArticle(undefined)
    setIsArticleModalOpen(true)
  }

  const handleEditArticleClick = (article: Article) => {
    setEditingArticle(article)
    setIsArticleModalOpen(true)
  }

  const handleArticleSubmit = async (data: Partial<Article>) => {
    try {
      if (editingArticle) {
        await articlesAPI.update(editingArticle.id, data)
      } else {
        await articlesAPI.create(data)
      }
      setIsArticleModalOpen(false)
      fetchArticles()
      toast.success('Статья успешно сохранена')
    } catch {
      toast.error('Ошибка при сохранении статьи')
    }
  }

  const handleDeleteArticle = async (articleId: string) => {
    if (confirm('Удалить статью?')) {
      try {
        await articlesAPI.delete(articleId)
        fetchArticles()
        toast.success('Статья удалена')
      } catch {
        toast.error('Ошибка при удалении статьи')
      }
    }
  }

  // Filtered lists
  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (u.profile?.full_name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  const filteredExercises = exercises.filter(e =>
    !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredArticles = articles.filter(a =>
    !searchQuery || a.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const TABS = [
    { id: 'users' as const,     label: 'Пользователи', icon: Users },
    { id: 'exercises' as const, label: 'Упражнения',   icon: Dumbbell },
    { id: 'articles' as const,  label: 'Статьи',       icon: BookOpen },
  ]

  return (
    <AuthGuard requireRole="admin">
      <div className="min-h-screen">
        <main className="container mx-auto px-4 py-4 sm:py-8 max-w-5xl">

          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-7 w-7 text-primary" />
              Админ-панель
            </h1>
            {activeTab !== 'users' && (
              <Button
                size="sm"
                onClick={() => {
                  if (activeTab === 'exercises') handleCreateExerciseClick()
                  if (activeTab === 'articles') handleCreateArticleClick()
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                {activeTab === 'exercises' ? 'Упражнение' : 'Статья'}
              </Button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-white/10 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap shrink-0',
                  activeTab === id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="mb-5">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={
                  activeTab === 'users'     ? 'Поиск по имени или email...' :
                  activeTab === 'exercises' ? 'Поиск упражнений...' :
                  'Поиск статей...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 rounded-xl"
              />
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2">

              {/* ── Users ── */}
              {activeTab === 'users' && (
                filteredUsers.length === 0 ? (
                  <EmptyState icon={Users} text="Пользователи не найдены" />
                ) : filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/8 bg-card/40 hover:bg-card/60 transition-colors"
                  >
                    <UserAvatar name={user.profile?.full_name} email={user.email} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">
                          {user.profile?.full_name || user.email}
                        </p>
                        <RoleBadge role={user.role} />
                        {!user.is_active && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full border bg-destructive/15 text-destructive border-destructive/30 font-medium">
                            Заблокирован
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                        <span>{user.email}</span>
                        <span className="text-white/20">·</span>
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(user.created_at)}</span>
                      </div>
                    </div>
                    {user.id !== currentUser?.id && (
                      user.is_active ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleBlockUser(user.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
                        >
                          <UserX className="h-4 w-4 sm:mr-1.5" />
                          <span className="hidden sm:inline text-xs">Заблокировать</span>
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnblockUser(user.id)}
                          className="text-emerald-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg shrink-0"
                        >
                          <UserCheck className="h-4 w-4 sm:mr-1.5" />
                          <span className="hidden sm:inline text-xs">Разблокировать</span>
                        </Button>
                      )
                    )}
                  </div>
                ))
              )}

              {/* ── Exercises ── */}
              {activeTab === 'exercises' && (
                filteredExercises.length === 0 ? (
                  <EmptyState icon={Dumbbell} text="Упражнения не найдены" />
                ) : filteredExercises.map((exercise) => (
                  <div
                    key={exercise.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/8 bg-card/40 hover:bg-card/60 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-orange-500/15 text-orange-400 flex items-center justify-center shrink-0">
                      <Dumbbell className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{exercise.name}</p>
                      {exercise.muscle_groups && exercise.muscle_groups.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {exercise.muscle_groups.slice(0, 4).map(m => (
                            <span key={m} className="text-[11px] bg-primary/10 text-primary rounded-full px-2 py-0.5">
                              {translateMuscleGroup(m)}
                            </span>
                          ))}
                          {exercise.muscle_groups.length > 4 && (
                            <span className="text-[11px] text-muted-foreground">+{exercise.muscle_groups.length - 4}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditExerciseClick(exercise)}
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteExercise(exercise.id)}
                        className="h-8 w-8 rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}

              {/* ── Articles ── */}
              {activeTab === 'articles' && (
                filteredArticles.length === 0 ? (
                  <EmptyState icon={BookOpen} text="Статьи не найдены" />
                ) : filteredArticles.map((article) => (
                  <div
                    key={article.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/8 bg-card/40 hover:bg-card/60 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{article.title}</p>
                        {article.is_published ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-medium shrink-0">
                            Опубликована
                          </span>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/30 font-medium shrink-0">
                            Черновик
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />{formatDate(article.created_at)}
                        </span>
                        <span className="text-white/20">·</span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />{article.views_count}
                        </span>
                        {article.tags && article.tags.length > 0 && (
                          <>
                            <span className="text-white/20">·</span>
                            <span className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              {article.tags.slice(0, 2).join(', ')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditArticleClick(article)}
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteArticle(article.id)}
                        className="h-8 w-8 rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}

            </div>
          )}

        </main>

        {/* Exercise modal */}
        <Modal
          isOpen={isExerciseModalOpen}
          onClose={() => setIsExerciseModalOpen(false)}
          title={editingExercise ? 'Редактировать упражнение' : 'Создать упражнение'}
          description="Заполните информацию об упражнении. Выберите группы мышц на схеме."
          footer={null}
          className="max-w-4xl"
        >
          <div className="py-2">
            <ExerciseForm
              initialData={editingExercise}
              onSubmit={handleExerciseSubmit}
              onCancel={() => setIsExerciseModalOpen(false)}
            />
          </div>
        </Modal>

        {/* Article modal */}
        <Modal
          isOpen={isArticleModalOpen}
          onClose={() => setIsArticleModalOpen(false)}
          title={editingArticle ? 'Редактировать статью' : 'Создать статью'}
          description="Заполните информацию о статье. HTML файл должен быть в папке frontend/articles/"
          footer={null}
          className="max-w-2xl"
        >
          <div className="py-2">
            <ArticleForm
              initialData={editingArticle}
              onSubmit={handleArticleSubmit}
              onCancel={() => setIsArticleModalOpen(false)}
            />
          </div>
        </Modal>
      </div>
    </AuthGuard>
  )
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="text-center py-16 rounded-2xl border border-dashed border-white/10">
      <Icon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
