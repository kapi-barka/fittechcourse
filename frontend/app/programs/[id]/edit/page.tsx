/**
 * Страница редактирования тренировочной программы
 */
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { AuthGuard } from '@/components/AuthGuard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { programsAPI, exercisesAPI, uploadAPI, Exercise } from '@/lib/api'
import {
  Dumbbell,
  Plus,
  Trash2,
  ArrowLeft,
  Save,
  Image as ImageIcon,
  Upload
} from 'lucide-react'

import { getDayName } from '@/lib/utils'

interface ProgramDetail {
  exercise_id: string
  day_number: number
  sets: number
  reps: number
  rest_time: number
  order: number
  notes: string
}

export default function EditProgramPage() {
  const router = useRouter()
  const params = useParams()
  const programId = params.id as string

  const [exercises, setExercises] = useState<Exercise[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Данные программы
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [difficulty, setDifficulty] = useState<string>('')
  const [durationWeeks, setDurationWeeks] = useState<number>(4)
  const [targetMuscles, setTargetMuscles] = useState<string[]>([])
  const [imageUrl, setImageUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [details, setDetails] = useState<ProgramDetail[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [error, setError] = useState('')

  const MUSCLE_GROUPS = [
    { id: 'traps', label: 'Трапеция' },
    { id: 'shoulders', label: 'Плечи' },
    { id: 'chest', label: 'Грудь' },
    { id: 'biceps', label: 'Бицепс' },
    { id: 'forearms', label: 'Предплечья' },
    { id: 'abdominals', label: 'Пресс' },
    { id: 'obliques', label: 'Косые' },
    { id: 'quads', label: 'Квадрицепс' },
    { id: 'calves', label: 'Икры' },
    { id: 'traps-middle', label: 'Средняя трапеция' },
    { id: 'lats', label: 'Широчайшие' },
    { id: 'rear-shoulders', label: 'Задняя дельта' },
    { id: 'triceps', label: 'Трицепс' },
    { id: 'lowerback', label: 'Поясница' },
    { id: 'glutes', label: 'Ягодицы' },
    { id: 'hamstrings', label: 'Бицепс бедра' },
  ]

  const toggleMuscle = (muscleId: string) => {
    if (targetMuscles.includes(muscleId)) {
      setTargetMuscles(targetMuscles.filter(m => m !== muscleId))
    } else {
      setTargetMuscles([...targetMuscles, muscleId])
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const res = await uploadAPI.uploadFile(file, 'programs')
      setImageUrl(res.data.url)
    } catch (error) {
      console.error('Error uploading image:', error)
      setError('Ошибка загрузки изображения')
    } finally {
      setIsUploading(false)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchExercises()
        if (programId) {
          await fetchProgram(programId)
        }
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [programId])

  const fetchExercises = async () => {
    try {
      const res = await exercisesAPI.list()
      setExercises(res.data)
    } catch (error) {
      console.error('Error fetching exercises:', error)
    }
  }

  const fetchProgram = async (id: string) => {
    try {
      const res = await programsAPI.get(id)
      const program = res.data

      setTitle(program.title)
      setDescription(program.description || '')
      setIsPublic(program.is_public)
      setDifficulty(program.difficulty || '')
      setDurationWeeks(program.duration_weeks || 4)
      setImageUrl(program.image_url || '')

      if (program.target_muscle_groups) {
        setTargetMuscles(program.target_muscle_groups.split(','))
      } else {
        setTargetMuscles([])
      }

      // Map details to match the form structure
      if (program.details) {
        const mappedDetails = program.details.map(d => ({
          exercise_id: d.exercise_id,
          day_number: d.day_number,
          sets: d.sets,
          reps: d.reps,
          rest_time: d.rest_time || 60,
          order: d.order,
          notes: d.notes || ''
        }))
        // Sort by day and order just in case
        mappedDetails.sort((a, b) => {
          if (a.day_number !== b.day_number) return a.day_number - b.day_number
          return a.order - b.order
        })
        setDetails(mappedDetails)
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Ошибка загрузки программы')
    }
  }

  const addExerciseDetail = () => {
    setDetails([
      ...details,
      {
        exercise_id: exercises[0]?.id || '',
        day_number: 1,
        sets: 3,
        reps: 10,
        rest_time: 60,
        order: details.length,
        notes: ''
      }
    ])
  }

  const removeExerciseDetail = (index: number) => {
    setDetails(details.filter((_, i) => i !== index))
  }

  const updateExerciseDetail = (index: number, field: keyof ProgramDetail, value: string | number | string[] | undefined) => {
    const newDetails = [...details]
    newDetails[index] = {
      ...newDetails[index],
      [field]: value
    }
    setDetails(newDetails)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!title.trim()) {
      setError('Укажите название программы')
      return
    }

    setIsSaving(true)

    try {
      // Fix order based on current array index
      const orderedDetails = details.map((d, index) => ({
        ...d,
        order: index
      }))

      const programData = {
        title: title.trim(),
        description: description.trim() || undefined,
        is_public: isPublic,
        difficulty: difficulty || undefined,
        duration_weeks: durationWeeks || undefined,
        target_muscle_groups: targetMuscles.length > 0 ? targetMuscles.join(',') : undefined,
        image_url: imageUrl || undefined,
        details: orderedDetails.length > 0 ? orderedDetails : undefined
      }

      await programsAPI.update(programId, programData)
      router.push(`/programs/${programId}`)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Ошибка при сохранении программы')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen">
          <main className="container mx-auto px-4 py-8">
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="mt-4 text-muted-foreground">Загрузка...</p>
            </div>
          </main>
        </div>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">

        <main className="container mx-auto px-4 py-8">
          {/* Заголовок */}
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад
            </Button>

            <h1 className="text-4xl font-extrabold mb-2 text-gray-900 dark:text-gray-100">
              Редактировать программу
            </h1>
            <p className="text-muted-foreground font-medium">
              Измените информацию о программе и упражнениях
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Основная информация */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Основная информация</CardTitle>
                <CardDescription>
                  Общие данные о тренировочной программе
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-muted/5">
                  {imageUrl ? (
                    <div className="relative w-full max-w-md h-48 rounded-lg overflow-hidden mb-4">
                      <img
                        src={imageUrl}
                        alt="Program cover"
                        className="w-full h-full object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => setImageUrl('')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center mb-4">
                      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-2">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Загрузите обложку для программы
                      </p>
                    </div>
                  )}

                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {isUploading ? (
                        <span className="animate-spin mr-2">⏳</span>
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {imageUrl ? 'Изменить изображение' : 'Загрузить изображение'}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={isUploading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Название программы *
                  </label>
                  <Input
                    placeholder="Например: Программа для набора массы"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Описание
                  </label>
                  <Textarea
                    placeholder="Опишите цели и особенности программы"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Уровень сложности
                    </label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Не указан</option>
                      <option value="beginner">Начинающий</option>
                      <option value="intermediate">Средний</option>
                      <option value="advanced">Продвинутый</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Длительность (недели)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="52"
                      value={durationWeeks}
                      onChange={(e) => setDurationWeeks(parseInt(e.target.value) || 4)}
                    />
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center space-x-2 cursor-pointer h-10">
                      <input
                        type="checkbox"
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-sm font-medium">
                        Публичная программа
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Целевые группы мышц
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-4 border rounded-md bg-muted/10">
                    {MUSCLE_GROUPS.map(muscle => (
                      <label key={muscle.id} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={targetMuscles.includes(muscle.id)}
                          onChange={() => toggleMuscle(muscle.id)}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm">{muscle.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Упражнения */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Упражнения</CardTitle>
                    <CardDescription>
                      Добавьте упражнения в программу
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    onClick={addExerciseDetail}
                    disabled={exercises.length === 0}
                    variant="outline"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить упражнение
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {exercises.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Dumbbell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Нет доступных упражнений.</p>
                    <p className="text-sm">Обратитесь к администратору для добавления упражнений.</p>
                  </div>
                ) : details.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Упражнения не добавлены</p>
                    <p className="text-sm">Нажмите &quot;Добавить упражнение&quot; чтобы начать</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {details.map((detail, index) => (
                      <div
                        key={index}
                        className="p-4 border rounded-lg bg-muted/30 space-y-3"
                      >
                        <div className="flex justify-between items-start">
                          <h4 className="font-medium">Упражнение #{index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeExerciseDetail(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium mb-1">
                              Упражнение
                            </label>
                            <select
                              value={detail.exercise_id}
                              onChange={(e) => updateExerciseDetail(index, 'exercise_id', e.target.value)}
                              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              {exercises.map((exercise) => (
                                <option key={exercise.id} value={exercise.id}>
                                  {exercise.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1">
                              День недели
                            </label>
                            <select
                              value={detail.day_number}
                              onChange={(e) => updateExerciseDetail(index, 'day_number', parseInt(e.target.value) || 1)}
                              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              {[1, 2, 3, 4, 5, 6, 7].map(day => (
                                <option key={day} value={day}>
                                  {getDayName(day)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1">
                              Подходы
                            </label>
                            <Input
                              type="number"
                              min="1"
                              max="20"
                              value={detail.sets}
                              onChange={(e) => updateExerciseDetail(index, 'sets', parseInt(e.target.value) || 3)}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1">
                              Повторения
                            </label>
                            <Input
                              type="number"
                              min="1"
                              max="100"
                              value={detail.reps}
                              onChange={(e) => updateExerciseDetail(index, 'reps', parseInt(e.target.value) || 10)}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1">
                              Отдых (сек)
                            </label>
                            <Input
                              type="number"
                              min="0"
                              max="600"
                              value={detail.rest_time}
                              onChange={(e) => updateExerciseDetail(index, 'rest_time', parseInt(e.target.value) || 60)}
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium mb-1">
                              Примечания
                            </label>
                            <Input
                              placeholder="Дополнительные указания"
                              value={detail.notes}
                              onChange={(e) => updateExerciseDetail(index, 'notes', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Кнопки действий */}
            <div className="flex gap-4">
              <Button
                type="submit"
                isLoading={isSaving}
                disabled={!title.trim()}
              >
                <Save className="mr-2 h-4 w-4" />
                Сохранить изменения
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSaving}
              >
                Отмена
              </Button>
            </div>
          </form>
        </main>
      </div>
    </AuthGuard>
  )
}

