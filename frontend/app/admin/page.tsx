/**
 * Админ-панель для управления пользователями и контентом
 */
'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { AuthGuard } from '@/components/AuthGuard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
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
  BookOpen
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { ExerciseForm } from '@/components/admin/ExerciseForm'
import { ArticleForm } from '@/components/admin/ArticleForm'
import { toast } from 'react-toastify'

export default function AdminPage() {
  const { user: currentUser } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'users' | 'exercises' | 'articles'>('users')
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers()
    } else if (activeTab === 'exercises') {
      fetchExercises()
    } else if (activeTab === 'articles') {
      fetchArticles()
    }
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
    } catch (error) {
      console.error('Error blocking user:', error)
    }
  }

  const handleUnblockUser = async (userId: string) => {
    try {
      await usersAPI.unblockUser(userId)
      fetchUsers()
    } catch (error) {
      console.error('Error unblocking user:', error)
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
    } catch (error) {
      console.error('Error saving exercise:', error)
      toast.error('Ошибка при сохранении упражнения')
    }
  }

  const handleDeleteExercise = async (exerciseId: string) => {
    if (confirm('Удалить упражнение?')) {
      try {
        await exercisesAPI.delete(exerciseId)
        fetchExercises()
        toast.success('Упражнение удалено')
      } catch (error) {
        console.error('Error deleting exercise:', error)
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
    } catch (error) {
      console.error('Error saving article:', error)
      toast.error('Ошибка при сохранении статьи')
    }
  }

  const handleDeleteArticle = async (articleId: string) => {
    if (confirm('Удалить статью?')) {
      try {
        await articlesAPI.delete(articleId)
        fetchArticles()
        toast.success('Статья удалена')
      } catch (error) {
        console.error('Error deleting article:', error)
        toast.error('Ошибка при удалении статьи')
      }
    }
  }

  return (
    <AuthGuard requireRole="admin">
      <div className="min-h-screen">

        <main className="container mx-auto px-4 py-8">
          {/* Табы */}
          <div className="flex space-x-2 mb-8 border-b">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'users'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
              <Users className="inline-block mr-2 h-4 w-4" />
              Пользователи
            </button>
            <button
              onClick={() => setActiveTab('exercises')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'exercises'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
              <Dumbbell className="inline-block mr-2 h-4 w-4" />
              Упражнения
            </button>
            <button
              onClick={() => setActiveTab('articles')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'articles'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
              <BookOpen className="inline-block mr-2 h-4 w-4" />
              Статьи
            </button>
          </div>

          {/* Контент */}
          <Card className="border-0">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>
                  {activeTab === 'users' && 'Управление пользователями'}
                  {activeTab === 'exercises' && 'Управление упражнениями'}
                  {activeTab === 'articles' && 'Управление статьями'}
                </CardTitle>
                {activeTab !== 'users' && (
                  <Button
                    onClick={() => {
                      if (activeTab === 'exercises') handleCreateExerciseClick()
                      if (activeTab === 'articles') handleCreateArticleClick()
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Создать
                  </Button>
                )}
              </div>

              {activeTab === 'users' && (
                <div className="mt-4">
                  <Input
                    placeholder="Поиск пользователей по имени или email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-md"
                  />
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
              ) : (
                <div className="space-y-3">
                  {activeTab === 'users' && users
                    .filter(u => {
                      if (!searchQuery) return true
                      const query = searchQuery.toLowerCase()
                      const name = (u.profile?.full_name || '').toLowerCase()
                      const email = u.email.toLowerCase()
                      return name.includes(query) || email.includes(query)
                    })
                    .map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">{user.profile?.full_name || user.email}</p>
                          <div className="flex items-center space-x-3 mt-1 text-sm text-muted-foreground">
                            <span className="capitalize">{user.role}</span>
                            <span>•</span>
                            <span>{formatDate(user.created_at)}</span>
                            {!user.is_active && (
                              <>
                                <span>•</span>
                                <span className="text-destructive">Заблокирован</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {user.id !== currentUser?.id && (
                            user.is_active ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleBlockUser(user.id)}
                              >
                                <UserX className="h-4 w-4 text-destructive mr-2" />
                                Заблокировать
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnblockUser(user.id)}
                              >
                                <UserCheck className="h-4 w-4 text-green-500 mr-2" />
                                Разблокировать
                              </Button>
                            )
                          )}
                      </div>
                    </div>
                  ))}

                  {activeTab === 'exercises' && exercises.map((exercise) => (
                    <div key={exercise.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{exercise.name}</p>
                        <div className="flex gap-2 mt-1">
                          {exercise.muscle_groups?.map(m => (
                            <span key={m} className="text-xs text-muted-foreground bg-background border px-1.5 py-0.5 rounded capitalize">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditExerciseClick(exercise)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteExercise(exercise.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {activeTab === 'articles' && articles.map((article) => (
                    <div key={article.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{article.title}</p>
                          {!article.is_published && (
                            <span className="text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded">
                              Черновик
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span>{article.html_file_name}</span>
                          <span>•</span>
                          <span>{formatDate(article.created_at)}</span>
                          <span>•</span>
                          <span>{article.views_count} просмотров</span>
                        </div>
                        {article.tags && article.tags.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {article.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="text-xs text-muted-foreground bg-background border px-1.5 py-0.5 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditArticleClick(article)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteArticle(article.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Модальное окно создания/редактирования упражнения */}
          <Modal
            isOpen={isExerciseModalOpen}
            onClose={() => setIsExerciseModalOpen(false)}
            title={editingExercise ? 'Редактировать упражнение' : 'Создать упражнение'}
            description="Заполните информацию об упражнении. Выберите группы мышц на схеме."
            footer={null} // Footer is inside the form
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

          {/* Модальное окно создания/редактирования статьи */}
          <Modal
            isOpen={isArticleModalOpen}
            onClose={() => setIsArticleModalOpen(false)}
            title={editingArticle ? 'Редактировать статью' : 'Создать статью'}
            description="Заполните информацию о статье. HTML файл должен быть в папке frontend/articles/"
            footer={null} // Footer is inside the form
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
        </main>
      </div>
    </AuthGuard>
  )
}
