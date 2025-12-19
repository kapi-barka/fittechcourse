/**
 * Компонент для сканирования штрихкодов
 * Поддерживает сканирование через камеру и загрузку фото
 * Использует нативный API камеры и серверное распознавание
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Camera, Upload, X, Keyboard, Loader2 } from 'lucide-react'
import { nutritionAPI } from '@/lib/api'

interface BarcodeScannerProps {
    onScan: (barcode: string) => void
    onClose: () => void
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
    const [isScanning, setIsScanning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [manualBarcode, setManualBarcode] = useState('')
    const [previewImage, setPreviewImage] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const streamRef = useRef<MediaStream | null>(null)

    // Очистка потока при размонтировании
    useEffect(() => {
        // Отладочное логирование всех кликов
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            if (target.closest('button')) {
                const button = target.closest('button')
                console.log('🖱️ Клик по кнопке:', button?.textContent?.trim(), button)
            }
        }
        
        document.addEventListener('click', handleClick)
        
        return () => {
            document.removeEventListener('click', handleClick)
            stopCamera()
        }
    }, [])

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
        setIsScanning(false)
    }

    const startScanning = async () => {
        console.log('=== startScanning CALLED ===')
        console.log('Current state:', { isScanning, isProcessing, hasVideoRef: !!videoRef.current })
        
        try {
            setError(null)
            console.log('Step 1: Stopping previous camera if any...')
            stopCamera() // Останавливаем предыдущий поток, если есть

            console.log('Step 2: Checking mediaDevices support...')
            if (!navigator.mediaDevices) {
                throw new Error('navigator.mediaDevices не доступен')
            }
            if (!navigator.mediaDevices.getUserMedia) {
                throw new Error('getUserMedia не поддерживается')
            }

            console.log('Step 3: Requesting camera access...')
            // Запрашиваем доступ к камере
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Задняя камера
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            })

            streamRef.current = stream
            console.log('Camera stream obtained:', {
                hasStream: !!stream,
                tracks: stream.getTracks().length,
                activeTracks: stream.getTracks().filter(t => t.readyState === 'live').length
            })

            // Устанавливаем состояние СНАЧАЛА, чтобы React отрендерил видео элемент
            console.log('Step 4: Setting isScanning to true to render video element...')
            setIsScanning(true)
            
            // Ждем, пока React отрендерит видео элемент
            // Используем requestAnimationFrame для синхронизации с циклом рендеринга
            console.log('Step 5: Waiting for video element to be rendered...')
            
            // Ждем несколько кадров рендеринга
            await new Promise(resolve => requestAnimationFrame(resolve))
            await new Promise(resolve => requestAnimationFrame(resolve))
            await new Promise(resolve => requestAnimationFrame(resolve))
            
            // Дополнительное ожидание на случай, если нужно больше времени
            let attempts = 0
            const maxAttempts = 20
            while (!videoRef.current && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 50))
                attempts++
                if (attempts % 5 === 0) {
                    console.log(`Waiting for video element... attempt ${attempts}/${maxAttempts}`)
                }
            }
            
            console.log(`Video element check after ${attempts} attempts:`, {
                found: !!videoRef.current,
                videoRef: videoRef.current,
                isScanning: isScanning
            })

            // Отображаем поток в video элементе
            if (videoRef.current) {
                console.log('Step 6: Video element found, setting up stream...')
                const video = videoRef.current
                
                // Устанавливаем поток
                video.srcObject = stream
                console.log('Stream set to video element:', {
                    hasStream: !!stream,
                    activeTracks: stream.getTracks().filter(t => t.readyState === 'live').length,
                    videoElement: !!video,
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight
                })
                
                // Ждем загрузки метаданных перед воспроизведением
                await new Promise<void>((resolve, reject) => {
                    if (!video) {
                        reject(new Error('Video element not found'))
                        return
                    }
                    
                    const onLoadedMetadata = () => {
                        video.removeEventListener('loadedmetadata', onLoadedMetadata)
                        video.removeEventListener('error', onError)
                        console.log('Video metadata loaded')
                        resolve()
                    }
                    
                    const onError = (e: Event) => {
                        video.removeEventListener('loadedmetadata', onLoadedMetadata)
                        video.removeEventListener('error', onError)
                        console.error('Video error:', e)
                        reject(new Error('Failed to load video metadata'))
                    }
                    
                    video.addEventListener('loadedmetadata', onLoadedMetadata)
                    video.addEventListener('error', onError)
                    
                    // Таймаут на случай, если событие не сработает
                    setTimeout(() => {
                        if (video.readyState >= 2) { // HAVE_CURRENT_DATA
                            video.removeEventListener('loadedmetadata', onLoadedMetadata)
                            video.removeEventListener('error', onError)
                            resolve()
                        }
                    }, 2000)
                })
                
                try {
                    await video.play()
                    console.log('Video playing successfully')
                } catch (playError) {
                    console.error('Error playing video:', playError)
                    setError('Не удалось воспроизвести видео с камеры')
                    stopCamera()
                }
            } else {
                console.error('❌ Video element not found after waiting!')
                console.error('Video ref:', videoRef.current)
                console.error('isScanning state:', isScanning)
                setError('Элемент видео не найден. Попробуйте обновить страницу или использовать "Загрузить фото".')
                stopCamera()
            }
        } catch (err: unknown) {
            const error = err as { name?: string; message?: string }
            console.error('Camera error:', err)
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                error: err
            })
            
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
            setIsProcessing(true)
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

            // Рисуем кадр из video на canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

            // Конвертируем canvas в blob
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    setError('Не удалось захватить изображение')
                    setIsProcessing(false)
                    return
                }

                // Создаем File из blob
                const file = new File([blob], 'barcode-photo.jpg', { type: 'image/jpeg' })

                // Отображаем предпросмотр
                const dataUrl = canvas.toDataURL('image/jpeg')
                setPreviewImage(dataUrl)

                // Отправляем на сервер для распознавания
                try {
                    const response = await nutritionAPI.scanBarcodeFromImage(file)
                    const barcode = response.data.barcode

                    if (barcode && barcode.length >= 8) {
                        stopCamera()
                        setPreviewImage(null)
                        onScan(barcode)
                    } else {
                        setError('Штрихкод не распознан. Попробуйте еще раз или введите вручную.')
                    }
                } catch (scanError: unknown) {
                    const error = scanError as { response?: { data?: { detail?: string } }; message?: string }
                    const errorDetail = error.response?.data?.detail || error.message || ''
                    
                    if (errorDetail.includes('не найден') || errorDetail.includes('not found')) {
                        setError('Штрихкод не найден на фото. Убедитесь, что штрихкод четко виден и попробуйте еще раз.')
                    } else {
                        setError('Не удалось распознать штрихкод. Попробуйте еще раз или введите вручную.')
                    }
                } finally {
                    setIsProcessing(false)
                }
            }, 'image/jpeg', 0.9)
        } catch (err) {
            console.error('Error capturing photo:', err)
            setError('Ошибка при захвате фото. Попробуйте еще раз.')
            setIsProcessing(false)
        }
    }

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        console.log('handleFileUpload called', event.target.files)
        const file = event.target.files?.[0]
        if (!file) {
            console.log('No file selected')
            return
        }
        console.log('File selected:', file.name, file.type, file.size)

        try {
            setError(null)
            setIsProcessing(true)

            // Проверяем размер файла
            if (file.size > 10 * 1024 * 1024) {
                setError('Файл слишком большой. Пожалуйста, выберите изображение меньше 10MB.')
                setIsProcessing(false)
                return
            }

            // Проверяем тип файла
            if (!file.type.startsWith('image/')) {
                setError('Выбранный файл не является изображением. Пожалуйста, выберите изображение (JPG, PNG, WebP).')
                setIsProcessing(false)
                return
            }

            // Создаем предпросмотр
            const reader = new FileReader()
            reader.onload = (e) => {
                const dataUrl = e.target?.result as string
                setPreviewImage(dataUrl)
            }
            reader.readAsDataURL(file)

            // Отправляем на сервер для распознавания
            const response = await nutritionAPI.scanBarcodeFromImage(file)
            const barcode = response.data.barcode

            if (barcode && barcode.length >= 8) {
                setPreviewImage(null)
                onScan(barcode)
            } else {
                setError('Штрихкод не распознан. Попробуйте еще раз или введите вручную.')
            }
        } catch (err: unknown) {
            console.error('File scan error:', err)
            const error = err as { response?: { data?: { detail?: string } }; message?: string }
            const errorDetail = error.response?.data?.detail || error.message || ''

            if (errorDetail.includes('не найден') || errorDetail.includes('not found')) {
                setError('Штрихкод не найден на фото. Убедитесь, что штрихкод четко виден и попробуйте еще раз.')
            } else {
                setError('Не удалось распознать штрихкод. Попробуйте еще раз или введите вручную.')
            }
        } finally {
            setIsProcessing(false)
            // Очищаем input, чтобы можно было загрузить тот же файл снова
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const handleScanSuccess = (barcode: string) => {
        const cleanedBarcode = barcode.trim()
        if (cleanedBarcode.length >= 8) {
            onScan(cleanedBarcode)
        } else {
            setError('Штрихкод слишком короткий. Попробуйте еще раз.')
        }
    }

    const handleManualSubmit = () => {
        if (manualBarcode.trim().length >= 8) {
            handleScanSuccess(manualBarcode.trim())
        } else {
            setError('Введите корректный штрихкод (минимум 8 символов)')
        }
    }

    const handleClose = async () => {
        stopCamera()
        onClose()
    }

    return (
        <div className="relative">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Сканировать штрихкод</h3>
                <Button variant="ghost" size="icon" onClick={handleClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Область сканирования */}
            <div className="w-full mb-4 rounded-lg overflow-hidden bg-black relative"
                style={{ 
                    height: '250px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {previewImage ? (
                    <div className="relative w-full h-full">
                        <img 
                            src={previewImage} 
                            alt="Предпросмотр" 
                            className="w-full h-full object-contain"
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 bg-white/80 hover:bg-white"
                            onClick={() => {
                                setPreviewImage(null)
                                if (fileInputRef.current) {
                                    fileInputRef.current.value = ''
                                }
                            }}
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
                            onLoadedData={() => {
                                console.log('Video loaded, dimensions:', {
                                    width: videoRef.current?.videoWidth,
                                    height: videoRef.current?.videoHeight,
                                    readyState: videoRef.current?.readyState,
                                    srcObject: !!videoRef.current?.srcObject
                                })
                            }}
                            onCanPlay={() => {
                                console.log('Video can play')
                            }}
                        />
                        {isProcessing && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                <div className="text-white">
                                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                                    <p>Обработка...</p>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">Выберите способ сканирования</p>
                    </div>
                )}

                {/* Скрытый canvas для захвата кадра */}
                <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Ошибка */}
            {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-lg text-sm whitespace-pre-line">
                    {error}
                </div>
            )}

            {/* Ручной ввод штрихкода */}
            <div className="mb-4">
                <div className="flex gap-2">
                    <Input
                        type="text"
                        placeholder="Или введите штрихкод вручную"
                        value={manualBarcode}
                        onChange={(e) => setManualBarcode(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                handleManualSubmit()
                            }
                        }}
                        className="flex-1"
                        disabled={isProcessing}
                    />
                    <Button
                        onClick={handleManualSubmit}
                        variant="outline"
                        disabled={!manualBarcode.trim() || isProcessing}
                    >
                        <Keyboard className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Кнопки управления */}
            <div className="flex gap-3">
                {!isScanning ? (
                    <>
                        <Button
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                console.log('🔵 КНОПКА КАМЕРА НАЖАТА!')
                                console.log('Event:', e)
                                console.log('isProcessing:', isProcessing)
                                console.log('isScanning:', isScanning)
                                try {
                                    startScanning()
                                } catch (err) {
                                    console.error('❌ Ошибка при вызове startScanning:', err)
                                }
                            }}
                            className="flex-1"
                            disabled={isProcessing}
                        >
                            <Camera className="mr-2 h-4 w-4" />
                            Камера
                        </Button>
                        <Button
                            onClick={() => {
                                console.log('Загрузить фото clicked')
                                // На мобильных устройствах capture откроет камеру напрямую
                                // На десктопе откроется диалог выбора файла
                                if (fileInputRef.current) {
                                    console.log('Clicking file input...')
                                    fileInputRef.current.click()
                                } else {
                                    console.error('File input ref is null!')
                                }
                            }}
                            variant="outline"
                            className="flex-1"
                            disabled={isProcessing}
                        >
                            <Upload className="mr-2 h-4 w-4" />
                            Загрузить фото
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            onClick={capturePhoto}
                            className="flex-1"
                            disabled={isProcessing}
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Обработка...
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
                            disabled={isProcessing}
                        >
                            Остановить
                        </Button>
                    </>
                )}
            </div>

            {/* Скрытый input для загрузки файла */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileUpload}
                onClick={(e) => {
                    console.log('🟢 INPUT CLICKED (это может открыть камеру напрямую)')
                }}
                disabled={isProcessing}
            />
        </div>
    )
}
