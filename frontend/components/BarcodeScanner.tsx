/**
 * Компонент для сканирования штрихкодов
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Input } from './ui/Input'
import { Camera, Upload, X, Loader2 } from 'lucide-react'
import { nutritionAPI } from '@/lib/api'

interface BarcodeScannerProps {
    onScan: (barcode: string) => void
    onClose: () => void
}

export function BarcodeScanner({ onScan }: BarcodeScannerProps) {
    const [isScanning, setIsScanning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [manualBarcode, setManualBarcode] = useState('')
    const [previewImage, setPreviewImage] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)

    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const streamRef = useRef<MediaStream | null>(null)

    useEffect(() => {
        return () => { stopCamera() }
    }, [])

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
            stopCamera()

            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error('getUserMedia не поддерживается')
            }

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

                try { await video.play() } catch {
                    setError('Не удалось воспроизвести видео с камеры')
                    stopCamera()
                }
            } else {
                setError('Элемент видео не найден. Попробуйте загрузить фото.')
                stopCamera()
            }
        } catch (err: unknown) {
            const e = err as { name?: string }
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                setError('Доступ к камере запрещён. Разрешите доступ в настройках браузера.')
            } else if (e.name === 'NotFoundError') {
                setError('Камера не найдена.')
            } else {
                setError('Не удалось получить доступ к камере. Попробуйте загрузить фото.')
            }
            setIsScanning(false)
        }
    }

    const capturePhoto = async () => {
        if (!videoRef.current || !canvasRef.current) return
        try {
            setIsProcessing(true)
            setError(null)
            const video = videoRef.current
            const canvas = canvasRef.current
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            const ctx = canvas.getContext('2d')
            if (!ctx) throw new Error('Canvas context error')
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

            canvas.toBlob(async (blob) => {
                if (!blob) { setError('Не удалось захватить изображение'); setIsProcessing(false); return }
                const file = new File([blob], 'barcode-photo.jpg', { type: 'image/jpeg' })
                setPreviewImage(canvas.toDataURL('image/jpeg'))

                try {
                    const response = await nutritionAPI.scanBarcodeFromImage(file)
                    const barcode = response.data.barcode
                    if (barcode && barcode.length >= 8) {
                        stopCamera()
                        setPreviewImage(null)
                        onScan(barcode)
                    } else {
                        setError('Штрихкод не распознан. Попробуйте ещё раз или введите вручную.')
                    }
                } catch {
                    setError('Не удалось распознать штрихкод. Попробуйте ещё раз или введите вручную.')
                } finally {
                    setIsProcessing(false)
                }
            }, 'image/jpeg', 0.9)
        } catch {
            setError('Ошибка при захвате фото.')
            setIsProcessing(false)
        }
    }

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return
        try {
            setError(null)
            setIsProcessing(true)
            if (file.size > 10 * 1024 * 1024) { setError('Файл слишком большой (макс. 10MB)'); setIsProcessing(false); return }
            if (!file.type.startsWith('image/')) { setError('Выберите изображение'); setIsProcessing(false); return }

            const reader = new FileReader()
            reader.onload = (e) => setPreviewImage(e.target?.result as string)
            reader.readAsDataURL(file)

            const response = await nutritionAPI.scanBarcodeFromImage(file)
            const barcode = response.data.barcode
            if (barcode && barcode.length >= 8) {
                setPreviewImage(null)
                onScan(barcode)
            } else {
                setError('Штрихкод не распознан. Введите вручную.')
            }
        } catch {
            setError('Не удалось распознать штрихкод.')
        } finally {
            setIsProcessing(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleManualSubmit = () => {
        const code = manualBarcode.trim()
        if (code.length >= 8) onScan(code)
        else setError('Введите корректный штрихкод (минимум 8 символов)')
    }

    return (
        <div className="space-y-3">
            {/* Viewfinder */}
            <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ height: 220 }}>
                {previewImage ? (
                    <>
                        <Image src={previewImage} alt="Предпросмотр" fill className="object-contain" unoptimized />
                        <button
                            onClick={() => { setPreviewImage(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                            className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </>
                ) : isScanning ? (
                    <>
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                        {isProcessing && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white gap-2">
                                <Loader2 className="h-7 w-7 animate-spin" />
                                <span className="text-sm">Обработка...</span>
                            </div>
                        )}
                        {/* Scanning frame overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-52 h-24 border-2 border-primary/70 rounded-lg" />
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                        <div className="w-52 h-24 border-2 border-dashed border-white/20 rounded-lg flex items-center justify-center">
                            <span className="text-xs text-center px-3">Наведите камеру на штрихкод или загрузите фото</span>
                        </div>
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
            <div className="grid grid-cols-2 gap-2">
                {!isScanning ? (
                    <>
                        <button
                            onClick={startScanning}
                            disabled={isProcessing}
                            className="flex items-center justify-center gap-2 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                            <Camera className="h-4 w-4" />Камера
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isProcessing}
                            className="flex items-center justify-center gap-2 h-10 rounded-xl border border-input bg-background text-sm font-medium hover:bg-accent disabled:opacity-50 transition-colors"
                        >
                            <Upload className="h-4 w-4" />Загрузить фото
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={capturePhoto}
                            disabled={isProcessing}
                            className="flex items-center justify-center gap-2 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                            {isProcessing ? 'Обработка...' : 'Сфотографировать'}
                        </button>
                        <button
                            onClick={stopCamera}
                            disabled={isProcessing}
                            className="flex items-center justify-center gap-2 h-10 rounded-xl border border-input bg-background text-sm font-medium hover:bg-accent disabled:opacity-50 transition-colors"
                        >
                            Остановить
                        </button>
                    </>
                )}
            </div>

            {/* Manual input */}
            <div className="flex gap-2">
                <Input
                    type="text"
                    placeholder="Или введите штрихкод вручную"
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleManualSubmit() }}
                    disabled={isProcessing}
                    className="flex-1 rounded-xl"
                />
                <button
                    onClick={handleManualSubmit}
                    disabled={!manualBarcode.trim() || isProcessing}
                    className="px-4 h-10 rounded-xl border border-input bg-background text-sm hover:bg-accent disabled:opacity-50 transition-colors shrink-0"
                >
                    OK
                </button>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
        </div>
    )
}
