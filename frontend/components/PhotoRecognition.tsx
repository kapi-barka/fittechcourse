/**
 * Компонент для распознавания продукта по фотографии
 */
'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Camera, Upload, X, Loader2, Image as ImageIcon } from 'lucide-react'
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

    useEffect(() => { return () => { stopCamera() } }, [])

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
        setIsScanning(false)
    }

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) { setError('Выберите изображение (JPG, PNG, WebP)'); return }
        if (file.size > 10 * 1024 * 1024) { setError('Файл слишком большой. Максимальный размер: 10MB'); return }
        const reader = new FileReader()
        reader.onload = (e) => setPreviewImage(e.target?.result as string)
        reader.readAsDataURL(file)
        setError(null)
    }

    const handleRecognize = async () => {
        const file = fileInputRef.current?.files?.[0]
        if (!file) { setError('Выберите изображение'); return }
        setIsRecognizing(true)
        setError(null)
        try {
            const response = await nutritionAPI.recognizeProductFromImage(file)
            if (response.data) {
                toast.success('Продукт успешно распознан')
                onRecognize(response.data)
            } else {
                setError('Не удалось распознать продукт на изображении')
            }
        } catch (err: unknown) {
            const e = err as { response?: { data?: { detail?: string } }; message?: string }
            setError(e.response?.data?.detail || e.message || 'Ошибка при распознавании. Попробуйте другое фото.')
        } finally {
            setIsRecognizing(false)
        }
    }

    const startScanning = async () => {
        try {
            setError(null)
            stopCamera()
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            })
            streamRef.current = stream
            setIsScanning(true)

            await new Promise(resolve => requestAnimationFrame(resolve))
            await new Promise(resolve => requestAnimationFrame(resolve))
            await new Promise(resolve => requestAnimationFrame(resolve))

            let attempts = 0
            while (!videoRef.current && attempts < 20) {
                await new Promise(resolve => setTimeout(resolve, 50))
                attempts++
            }

            if (videoRef.current) {
                const video = videoRef.current
                video.srcObject = stream
                await new Promise<void>((resolve, reject) => {
                    const onLoaded = () => { video.removeEventListener('loadedmetadata', onLoaded); video.removeEventListener('error', onErr); resolve() }
                    const onErr = () => { video.removeEventListener('loadedmetadata', onLoaded); video.removeEventListener('error', onErr); reject() }
                    video.addEventListener('loadedmetadata', onLoaded)
                    video.addEventListener('error', onErr)
                    setTimeout(() => { if (video.readyState >= 2) resolve() }, 2000)
                })
                try { await video.play() } catch { setError('Не удалось воспроизвести видео'); stopCamera() }
            } else {
                setError('Элемент видео не найден')
                stopCamera()
            }
        } catch (err: unknown) {
            const e = err as { name?: string }
            if (e.name === 'NotAllowedError') setError('Доступ к камере запрещён.')
            else if (e.name === 'NotFoundError') setError('Камера не найдена.')
            else setError('Не удалось получить доступ к камере.')
            setIsScanning(false)
        }
    }

    const capturePhoto = async () => {
        if (!videoRef.current || !canvasRef.current) return
        try {
            setIsRecognizing(true)
            setError(null)
            const video = videoRef.current
            const canvas = canvasRef.current
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            const ctx = canvas.getContext('2d')
            if (!ctx) throw new Error('Canvas context error')
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

            canvas.toBlob(async (blob) => {
                if (!blob) { setError('Не удалось захватить изображение'); setIsRecognizing(false); return }
                const file = new File([blob], 'product-photo.jpg', { type: 'image/jpeg' })
                setPreviewImage(canvas.toDataURL('image/jpeg'))
                stopCamera()
                try {
                    const response = await nutritionAPI.recognizeProductFromImage(file)
                    if (response.data) { toast.success('Продукт успешно распознан'); onRecognize(response.data) }
                    else setError('Не удалось распознать продукт')
                } catch (err: unknown) {
                    const e = err as { response?: { data?: { detail?: string } }; message?: string }
                    setError(e.response?.data?.detail || e.message || 'Ошибка при распознавании.')
                } finally {
                    setIsRecognizing(false)
                }
            }, 'image/jpeg', 0.9)
        } catch {
            setError('Ошибка при захвате фото.')
            setIsRecognizing(false)
        }
    }

    const handleReset = () => {
        stopCamera()
        setPreviewImage(null)
        setError(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    return (
        <div className="space-y-3">
            {/* Viewfinder */}
            <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ height: 220 }}>
                {previewImage ? (
                    <>
                        <Image src={previewImage} alt="Предпросмотр" fill className="object-contain" unoptimized />
                        <button
                            onClick={handleReset}
                            className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </>
                ) : isScanning ? (
                    <>
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                        {isRecognizing && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white gap-2">
                                <Loader2 className="h-7 w-7 animate-spin" />
                                <span className="text-sm">Распознавание...</span>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                        <ImageIcon className="h-10 w-10 opacity-30" />
                        <span className="text-xs">Загрузите фото или включите камеру</span>
                    </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Error */}
            {error && (
                <div className="px-3 py-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-xl text-xs">
                    {error}
                </div>
            )}

            {/* Action buttons */}
            {previewImage && !isScanning ? (
                <>
                    <button
                        onClick={handleRecognize}
                        disabled={isRecognizing}
                        className="flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                        {isRecognizing ? <><Loader2 className="h-4 w-4 animate-spin" />Распознавание...</> : <><ImageIcon className="h-4 w-4" />Распознать</>}
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isRecognizing}
                            className="flex items-center justify-center gap-2 h-10 rounded-xl border border-input bg-background text-sm hover:bg-accent disabled:opacity-50 transition-colors"
                        >
                            <Upload className="h-4 w-4" />Изменить
                        </button>
                        <button
                            onClick={startScanning}
                            disabled={isRecognizing}
                            className="flex items-center justify-center gap-2 h-10 rounded-xl border border-input bg-background text-sm hover:bg-accent disabled:opacity-50 transition-colors"
                        >
                            <Camera className="h-4 w-4" />Камера
                        </button>
                    </div>
                </>
            ) : isScanning ? (
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={capturePhoto}
                        disabled={isRecognizing}
                        className="flex items-center justify-center gap-2 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                        {isRecognizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                        {isRecognizing ? 'Распознавание...' : 'Сфотографировать'}
                    </button>
                    <button
                        onClick={stopCamera}
                        disabled={isRecognizing}
                        className="flex items-center justify-center gap-2 h-10 rounded-xl border border-input bg-background text-sm hover:bg-accent disabled:opacity-50 transition-colors"
                    >
                        Остановить
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={startScanning}
                        className="flex items-center justify-center gap-2 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                        <Camera className="h-4 w-4" />Камера
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center justify-center gap-2 h-10 rounded-xl border border-input bg-background text-sm hover:bg-accent transition-colors"
                    >
                        <Upload className="h-4 w-4" />Загрузить фото
                    </button>
                </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
        </div>
    )
}
