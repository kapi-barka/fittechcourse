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
import { usersAPI, exercisesAPI, User, Exercise } from '@/lib/api'
import {
  Shield,
  Users,
  Dumbbell,
  UserCheck,
  UserX,
  Plus,
  Trash2,
  Edit
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { ExerciseForm } from '@/components/admin/ExerciseForm'
import { toast } from 'react-toastify'

export default function AdminPage() {
  const { user: currentUser } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'users' | 'exercises'>('users')
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers()
    } else {
      fetchExercises()
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
      } catch (error) {
        console.error('Error deleting exercise:', error)
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
          </div>

          {/* Контент */}
          <Card className="border-0">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>
                  {activeTab === 'users' && 'Управление пользователями'}
                  {activeTab === 'exercises' && 'Управление упражнениями'}
                </CardTitle>
                {activeTab !== 'users' && (
                  <Button
                    onClick={() => {
                      if (activeTab === 'exercises') handleCreateExerciseClick()
                      // TODO: Add article create handler
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
        </main>
      </div>
    </AuthGuard>
  )
}
