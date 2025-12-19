/**
 * Компонент для распознавания продукта по фотографии
 */
'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Button } from './ui/Button'
import { Upload, X, Image as ImageIcon, Loader2, Camera } from 'lucide-react'
import { nutritionAPI } from '@/lib/api'
import { toast } from 'react-toastify'

interface PhotoRecognitionProps {
    onRecognize: (productData: {
      name?: string
      estimated_calories_per_100g?: number | null
      estimated_proteins_per_100g?: number | null
      estimated_fats_per_100g?: number | null
      estimated_carbs_per_100g?: number | null
      brand?: string | null
      category?: string | null
      description?: string | null
    }) => void
    onClose?: () => void
}

export function PhotoRecognition({ onRecognize }: PhotoRecognitionProps) {
    const [previewImage, setPreviewImage] = useState<string | null>(null)
    const [isRecognizing, setIsRecognizing] = useState(false)
    const [isScanning, setIsScanning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)

    // Очистка потока при размонтировании
    useEffect(() => {
        return () => {
            stopCamera()
        }
    }, [])

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        // Проверяем тип файла
        if (!file.type.startsWith('image/')) {
            setError('Выберите изображение (JPG, PNG, WebP)')
            return
        }

        // Проверяем размер файла
        if (file.size > 10 * 1024 * 1024) { // 10MB
            setError('Файл слишком большой. Максимальный размер: 10MB')
            return
        }

        // Создаем предпросмотр
        const reader = new FileReader()
        reader.onload = (e) => {
            setPreviewImage(e.target?.result as string)
        }
        reader.readAsDataURL(file)
        setError(null)
    }

    const handleRecognize = async () => {
        const file = fileInputRef.current?.files?.[0]
        if (!file) {
            setError('Выберите изображение')
            return
        }

        setIsRecognizing(true)
        setError(null)

        try {
            const response = await nutritionAPI.recognizeProductFromImage(file)
            
            if (response.data) {
                toast.success('Продукт успешно распознан')
                onRecognize(response.data)
            } else {
                const errorMsg = 'Не удалось распознать продукт на изображении'
                setError(errorMsg)
                toast.error(errorMsg)
            }
        } catch (err: unknown) {
            const error = err as { response?: { data?: { detail?: string } }; message?: string }
            const errorDetail = error.response?.data?.detail || error.message || ''
            const errorMsg = errorDetail || 'Ошибка при распознавании продукта. Попробуйте другое фото.'
            setError(errorMsg)
            toast.error(errorMsg)
        } finally {
            setIsRecognizing(false)
        }
    }

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
        setIsScanning(false)
    }

    const startScanning = async () => {
        try {
            setError(null)
            stopCamera() // Останавливаем предыдущий поток, если есть

            // Запрашиваем доступ к камере
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Задняя камера
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            })

            streamRef.current = stream

            // Устанавливаем состояние СНАЧАЛА, чтобы React отрендерил видео элемент
            setIsScanning(true)
            
            // Ждем, пока React отрендерит видео элемент
            await new Promise(resolve => requestAnimationFrame(resolve))
            await new Promise(resolve => requestAnimationFrame(resolve))
            await new Promise(resolve => requestAnimationFrame(resolve))
            
            // Дополнительное ожидание
            let attempts = 0
            while (!videoRef.current && attempts < 20) {
                await new Promise(resolve => setTimeout(resolve, 50))
                attempts++
            }

            // Отображаем поток в video элементе
            if (videoRef.current) {
                const video = videoRef.current
                video.srcObject = stream
                
                // Ждем загрузки метаданных перед воспроизведением
                await new Promise<void>((resolve, reject) => {
                    const onLoadedMetadata = () => {
                        video.removeEventListener('loadedmetadata', onLoadedMetadata)
                        video.removeEventListener('error', onError)
                        resolve()
                    }
                    
                    const onError = () => {
                        video.removeEventListener('loadedmetadata', onLoadedMetadata)
                        video.removeEventListener('error', onError)
                        reject(new Error('Failed to load video metadata'))
                    }
                    
                    video.addEventListener('loadedmetadata', onLoadedMetadata)
                    video.addEventListener('error', onError)
                    
                    setTimeout(() => {
                        if (video.readyState >= 2) {
                            resolve()
                        }
                    }, 2000)
                })
                
                try {
                    await video.play()
                } catch (playError) {
                    console.error('Error playing video:', playError)
                    setError('Не удалось воспроизвести видео с камеры')
                    stopCamera()
                }
            } else {
                setError('Элемент видео не найден')
                stopCamera()
            }
        } catch (err: unknown) {
            const error = err as { name?: string; message?: string }
            console.error('Camera error:', err)
            
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                setError('Доступ к камере запрещен. Разрешите доступ к камере в настройках браузера.')
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                setError('Камера не найдена. Убедитесь, что камера подключена и доступна.')
            } else {
                setError('Не удалось получить доступ к камере. Попробуйте загрузить фото.')
            }
            setIsScanning(false)
        }
    }

    const capturePhoto = async () => {
        if (!videoRef.current || !canvasRef.current) {
            return
        }

        try {
            setIsRecognizing(true)
            setError(null)

            const video = videoRef.current
            const canvas = canvasRef.current

            // Устанавливаем размеры canvas равными размерам video
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight

            // Рисуем кадр из video на canvas
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                throw new Error('Не удалось получить контекст canvas')
            }

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

            // Конвертируем canvas в blob
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    setError('Не удалось захватить изображение')
                    setIsRecognizing(false)
                    return
                }

                // Создаем File из blob
                const file = new File([blob], 'product-photo.jpg', { type: 'image/jpeg' })

                // Отображаем предпросмотр
                const dataUrl = canvas.toDataURL('image/jpeg')
                setPreviewImage(dataUrl)

                // Останавливаем камеру
                stopCamera()

                // Отправляем на сервер для распознавания
                try {
                    const response = await nutritionAPI.recognizeProductFromImage(file)
                    
                    if (response.data) {
                        toast.success('Продукт успешно распознан')
                        onRecognize(response.data)
                    } else {
                        const errorMsg = 'Не удалось распознать продукт на изображении'
                        setError(errorMsg)
                        toast.error(errorMsg)
                    }
                } catch (recognizeError: unknown) {
                    const error = recognizeError as { response?: { data?: { detail?: string } }; message?: string }
                    const errorDetail = error.response?.data?.detail || error.message || ''
                    const errorMsg = errorDetail || 'Ошибка при распознавании продукта. Попробуйте другое фото.'
                    setError(errorMsg)
                    toast.error(errorMsg)
                } finally {
                    setIsRecognizing(false)
                }
            }, 'image/jpeg', 0.9)
        } catch (err) {
            console.error('Error capturing photo:', err)
            setError('Ошибка при захвате фото. Попробуйте еще раз.')
            setIsRecognizing(false)
        }
    }

    const handleReset = () => {
        stopCamera()
        setPreviewImage(null)
        setError(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    return (
        <div className="space-y-4">
            <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                    Загрузите фото продукта для автоматического распознавания
                </p>
            </div>

            {/* Область предпросмотра */}
            <div 
                className="w-full rounded-lg overflow-hidden bg-black relative"
                style={{ 
                    height: '300px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {previewImage ? (
                    <div className="relative w-full h-full">
                        <Image 
                            src={previewImage} 
                            alt="Предпросмотр" 
                            width={400}
                            height={400}
                            className="w-full h-full object-contain"
                            unoptimized
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 bg-white/80 hover:bg-white"
                            onClick={handleReset}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ) : isScanning ? (
                    <>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-contain"
                            style={{
                                display: 'block',
                                minWidth: '100%',
                                minHeight: '100%',
                            }}
                        />
                        {isRecognizing && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                <div className="text-white">
                                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                                    <p>Распознавание...</p>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
                        <p className="text-sm">Выберите изображение продукта</p>
                    </div>
                )}

                {/* Скрытый canvas для захвата кадра */}
                <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Ошибка */}
            {error && (
                <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {/* Кнопки */}
            <div className="flex flex-col gap-2">
                {!isScanning ? (
                    previewImage ? (
                        // Когда есть фото - показываем кнопки для распознавания и изменения
                        <>
                    <Button
                        onClick={handleRecognize}
                        disabled={isRecognizing}
                                className="w-full"
                    >
                        {isRecognizing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Распознавание...
                            </>
                        ) : (
                            <>
                                <ImageIcon className="mr-2 h-4 w-4" />
                                Распознать
                            </>
                        )}
                    </Button>
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => fileInputRef.current?.click()}
                                    variant="outline"
                                    className="flex-1"
                                    disabled={isRecognizing}
                                >
                                    <Upload className="mr-2 h-4 w-4" />
                                    Изменить
                                </Button>
                                <Button
                                    onClick={startScanning}
                                    variant="outline"
                                    className="flex-1"
                                    disabled={isRecognizing}
                                >
                                    <Camera className="mr-2 h-4 w-4" />
                                    Камера
                                </Button>
                            </div>
                        </>
                    ) : (
                        // Когда нет фото - показываем кнопки для загрузки и камеры
                        <div className="flex gap-2">
                            <Button
                                onClick={() => fileInputRef.current?.click()}
                                variant="outline"
                                className="flex-1"
                                disabled={isRecognizing}
                            >
                                <Upload className="mr-2 h-4 w-4" />
                                Загрузить фото
                            </Button>
                            <Button
                                onClick={startScanning}
                                className="flex-1"
                                disabled={isRecognizing}
                            >
                                <Camera className="mr-2 h-4 w-4" />
                                Камера
                            </Button>
                        </div>
                    )
                ) : (
                    // Когда камера включена - показываем кнопки для съемки
                    <div className="flex gap-2">
                        <Button
                            onClick={capturePhoto}
                            className="flex-1"
                            disabled={isRecognizing}
                        >
                            {isRecognizing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Распознавание...
                                </>
                            ) : (
                                <>
                                    <Camera className="mr-2 h-4 w-4" />
                                    Сфотографировать
                                </>
                            )}
                        </Button>
                        <Button
                            onClick={stopCamera}
                            variant="outline"
                            className="flex-1"
                            disabled={isRecognizing}
                        >
                            Остановить
                        </Button>
                    </div>
                )}
            </div>

            {/* Скрытый input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileSelect}
            />

            {/* Подсказка */}
            <div className="text-xs text-muted-foreground space-y-1">
                <p>• Используйте четкое фото продукта</p>
                <p>• Убедитесь, что название продукта видно</p>
                <p>• Поддерживаются форматы: JPG, PNG, WebP</p>
            </div>
        </div>
    )
}

