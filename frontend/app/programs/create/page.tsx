/**
 * Страница создания тренировочной программы
 */
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
import { STANDARD_MUSCLE_GROUPS, svgIdToStandardMuscleGroups, type StandardMuscleGroup } from '@/lib/muscleGroups'

interface ProgramDetail {
  exercise_id: string
  day_number: number
  sets: number
  reps: number
  rest_time: number
  order: number
  notes: string
}

const MUSCLE_GROUP_LABELS: Record<StandardMuscleGroup, string> = {
  'chest': 'Грудь',
  'lats': 'Широчайшие',
  'lowerback': 'Поясница',
  'quads': 'Квадрицепсы',
  'hamstrings': 'Бицепс бедра',
  'calves': 'Икры',
  'glutes': 'Ягодицы',
  'shoulders': 'Плечи',
  'rear-shoulders': 'Задние дельты',
  'triceps': 'Трицепсы',
  'biceps': 'Бицепсы',
  'abdominals': 'Пресс',
  'obliques': 'Косые мышцы',
  'traps': 'Трапеции',
  'traps-middle': 'Средняя трапеция',
  'forearms': 'Предплечья',
  'hands': 'Руки',
}

export default function CreateProgramPage() {
  const router = useRouter()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Данные программы
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [difficulty, setDifficulty] = useState<string>('')
  const [durationWeeks, setDurationWeeks] = useState<number>(4)
  const [targetMuscles, setTargetMuscles] = useState<StandardMuscleGroup[]>([])
  const [imageUrl, setImageUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [details, setDetails] = useState<ProgramDetail[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [error, setError] = useState('')

  const toggleMuscle = (svgId: string) => {
    // Преобразуем SVG ID в стандартные названия
    const standardGroups = svgIdToStandardMuscleGroups(svgId)
    if (standardGroups.length === 0) return
    
    // Используем первую группу (или можно добавить все)
    const muscleGroup = standardGroups[0]
    
    if (targetMuscles.includes(muscleGroup)) {
      setTargetMuscles(targetMuscles.filter(m => m !== muscleGroup))
    } else {
      setTargetMuscles([...targetMuscles, muscleGroup])
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
    fetchExercises()
  }, [])

  const fetchExercises = async () => {
    try {
      const res = await exercisesAPI.list()
      setExercises(res.data)
    } catch (error) {
      console.error('Error fetching exercises:', error)
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

    setIsLoading(true)

    try {
      const programData = {
        title: title.trim(),
        description: description.trim() || undefined,
        is_public: isPublic,
        difficulty: difficulty || undefined,
        target_muscle_groups: targetMuscles.length > 0 ? targetMuscles.join(',') : undefined,
        image_url: imageUrl || undefined,
        duration_weeks: durationWeeks || undefined,
        details: details.length > 0 ? details : undefined
      }

      const res = await programsAPI.create(programData)
      router.push(`/programs/${res.data.id}`)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Ошибка при создании программы')
    } finally {
      setIsLoading(false)
    }
  }

  // const getExerciseName = (exerciseId: string) => {
  //   const exercise = exercises.find(e => e.id === exerciseId)
  //   return exercise?.name || 'Упражнение'
  // }

  return (
    <AuthGuard>
      <div className="min-h-screen">

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
              Создать программу тренировок
            </h1>
            <p className="text-muted-foreground font-medium">
              Заполните информацию о программе и добавьте упражнения
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
                    {STANDARD_MUSCLE_GROUPS.map(muscle => (
                      <label key={muscle} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={targetMuscles.includes(muscle)}
                          onChange={() => {
                            if (targetMuscles.includes(muscle)) {
                              setTargetMuscles(targetMuscles.filter(m => m !== muscle))
                            } else {
                              setTargetMuscles([...targetMuscles, muscle])
                            }
                          }}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm">{MUSCLE_GROUP_LABELS[muscle]}</span>
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
                isLoading={isLoading}
                disabled={!title.trim()}
              >
                <Save className="mr-2 h-4 w-4" />
                Создать программу
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isLoading}
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


