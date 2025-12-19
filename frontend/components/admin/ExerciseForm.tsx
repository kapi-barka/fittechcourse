import { useState, useEffect } from 'react'
import { Exercise, uploadAPI } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { MuscleMap } from '@/components/ui/MuscleMap'
import { svgIdToStandardMuscleGroups, standardMuscleGroupToSvgIds } from '@/lib/muscleGroups'
import { X, Plus, Video, RefreshCw, Upload, Loader2 } from 'lucide-react'
import { toast } from 'react-toastify'

interface ExerciseFormProps {
    initialData?: Partial<Exercise>
    onSubmit: (data: Partial<Exercise>) => Promise<void>
    onCancel: () => void
    isLoading?: boolean
}

export const ExerciseForm = ({
    initialData,
    onSubmit,
    onCancel,
    isLoading
}: ExerciseFormProps) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        muscle_groups: [] as string[],
        video_urls: [] as string[] // Array of strings
    })
    const [videoInput, setVideoInput] = useState('')
    const [mapMode, setMapMode] = useState<'front' | 'back'>('front')
    const [isUploading, setIsUploading] = useState(false)

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                description: initialData.description || '',
                muscle_groups: initialData.muscle_groups || [],
                video_urls: initialData.video_urls || []
            })
        }
    }, [initialData])

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        try {
            const res = await uploadAPI.uploadFile(file, 'exercises')
            setFormData(prev => ({
                ...prev,
                video_urls: [...prev.video_urls, res.data.url]
            }))
        } catch (error) {
            console.error('Error uploading file:', error)
            toast.error('Ошибка при загрузке файла')
        } finally {
            setIsUploading(false)
            // Reset input
            e.target.value = ''
        }
    }

    const handleChange = (field: string, value: string | string[]) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const toggleMuscle = (svgId: string) => {
        // Преобразуем SVG ID в стандартное название группы мышц
        const standardGroups = svgIdToStandardMuscleGroups(svgId)
        if (standardGroups.length === 0) return
        
        const muscleGroup = standardGroups[0] // Используем первую группу
        
        setFormData(prev => {
            const current = prev.muscle_groups || []
            const exists = current.includes(muscleGroup)
            return {
                ...prev,
                muscle_groups: exists
                    ? current.filter(m => m !== muscleGroup)
                    : [...current, muscleGroup]
            }
        })
    }

    const addVideoUrl = () => {
        if (!videoInput) return
        if (formData.video_urls.length >= 2) return

        setFormData(prev => ({
            ...prev,
            video_urls: [...prev.video_urls, videoInput]
        }))
        setVideoInput('')
    }

    const removeVideoUrl = (index: number) => {
        setFormData(prev => ({
            ...prev,
            video_urls: prev.video_urls.filter((_, i) => i !== index)
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        await onSubmit(formData)
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <label className="text-sm font-medium">Название упражнения</label>
                <Input
                    placeholder="Например: Жим лежа"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    required
                />
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Группы мышц</label>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setMapMode(mapMode === 'front' ? 'back' : 'front')}
                    >
                        <RefreshCw className="h-3 w-3 mr-2" />
                        Вид {mapMode === 'front' ? 'спереди' : 'сзади'}
                    </Button>
                </div>

                <div className="grid md:grid-cols-2 gap-6 items-start">
                    <div className="bg-muted/30 rounded-xl p-4 border h-[400px] flex items-center justify-center">
                        <MuscleMap
                            mode={mapMode}
                            selectedMuscles={formData.muscle_groups.flatMap(mg => 
                                standardMuscleGroupToSvgIds(mg as any, mapMode)
                            )}
                            onSelect={toggleMuscle}
                            className="h-full w-auto"
                        />
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs text-muted-foreground mb-2">Выбранные мышцы:</p>
                        {formData.muscle_groups.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">Ничего не выбрано</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {formData.muscle_groups.map(m => (
                                    <div key={m} className="bg-primary/10 text-primary px-2 py-1 rounded-md text-sm flex items-center">
                                        <span className="capitalize">{m}</span>
                                        <button
                                            type="button"
                                            onClick={() => toggleMuscle(m)}
                                            className="ml-2 hover:text-destructive"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-4">
                            Нажмите на мышцу на схеме, чтобы выбрать или отменить выбор.
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium">Описание техники</label>
                <Textarea
                    placeholder="Опишите технику выполнения упражнения по шагам..."
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    className="min-h-[150px]"
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium">Видео инструкции (макс. 2)</label>

                <div className="space-y-4">
                    {formData.video_urls.map((url, index) => (
                        <div key={index} className="flex items-center gap-2 bg-muted/50 p-2 rounded-md">
                            <Video className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1 text-sm truncate">{url}</div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeVideoUrl(index)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>

                {formData.video_urls.length < 2 && (
                    <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Ссылка на видео (YouTube, Loom, etc.)"
                                value={videoInput}
                                onChange={(e) => setVideoInput(e.target.value)}
                            />
                            <Button type="button" onClick={addVideoUrl} variant="secondary">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="file"
                                accept="video/*,image/gif"
                                onChange={handleFileUpload}
                                className="hidden"
                                id="video-upload"
                                disabled={isUploading}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full"
                                onClick={() => document.getElementById('video-upload')?.click()}
                                disabled={isUploading}
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Загрузка...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="h-4 w-4 mr-2" />
                                        Загрузить видео/GIF
                                    </>
                                )}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Поддерживаются видео (mp4, webm) и GIF. Макс. 100MB.
                        </p>
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onCancel}>
                    Отмена
                </Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Сохранение...' : 'Сохранить'}
                </Button>
            </div>
        </form>
    )
}
