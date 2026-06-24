
'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { BarcodeScanner } from './BarcodeScanner'
import { PhotoRecognition } from './PhotoRecognition'
import { nutritionAPI, FoodProduct } from '@/lib/api'
import { Barcode, Loader2, Image as ImageIcon, ArrowLeft, Flame, Beef, Droplets, Wheat, Type, Sparkles } from 'lucide-react'
import { toast } from 'react-toastify'
import { cn } from '@/lib/utils'

interface AddMealModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

const MEAL_TYPES: { value: MealType; label: string }[] = [
    { value: 'breakfast', label: 'Завтрак' },
    { value: 'lunch',     label: 'Обед' },
    { value: 'dinner',    label: 'Ужин' },
    { value: 'snack',     label: 'Перекус' },
]

function ProductCard({ product }: { product: FoodProduct }) {
    return (
        <div className="rounded-xl border border-white/8 bg-card/60 p-4">
            <p className="font-semibold text-base leading-snug">{product.name}</p>
            {product.brand && <p className="text-xs text-muted-foreground mt-0.5">{product.brand}</p>}
            {product.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{product.description}</p>}
            <p className="text-[10px] text-muted-foreground mt-2 mb-3 uppercase tracking-wider">На 100г</p>
            <div className="grid grid-cols-4 gap-2">
                {[
                    { label: 'Калории', value: product.calories ?? '—', icon: Flame, color: 'text-orange-400' },
                    { label: 'Белки',   value: product.proteins != null ? `${product.proteins}г` : '—', icon: Beef, color: 'text-red-400' },
                    { label: 'Жиры',    value: product.fats != null ? `${product.fats}г` : '—', icon: Droplets, color: 'text-yellow-400' },
                    { label: 'Углев.',  value: product.carbs != null ? `${product.carbs}г` : '—', icon: Wheat, color: 'text-blue-400' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-white/4 rounded-lg p-2 text-center">
                        <Icon className={cn('h-3.5 w-3.5 mx-auto mb-1', color)} />
                        <p className="text-sm font-semibold leading-none">{value}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

export function AddMealModal({ isOpen, onClose, onSuccess }: AddMealModalProps) {
    const [activeTab, setActiveTab] = useState<'barcode' | 'photo' | 'text'>('barcode')
    const [textInput, setTextInput] = useState('')
    const [scannedProduct, setScannedProduct] = useState<FoodProduct | null>(null)
    const [weight, setWeight] = useState('')
    const [mealType, setMealType] = useState<MealType>('lunch')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleBarcodeScan = async (barcode: string) => {
        setIsLoading(true)
        setError(null)
        try {
            const response = await nutritionAPI.lookupBarcode(barcode)
            if (response.data) {
                setScannedProduct(response.data)
            } else {
                setError('Продукт не найден в базе данных.')
            }
        } catch (err: unknown) {
            const e = err as { response?: { data?: { detail?: string } }; message?: string }
            const detail = e.response?.data?.detail || e.message || ''
            setError(detail.includes('не найден')
                ? 'Продукт не найден. Попробуйте добавить вручную.'
                : detail || 'Ошибка при поиске продукта.')
            setTimeout(() => setError(null), 8000)
        } finally {
            setIsLoading(false)
        }
    }

    const handlePhotoRecognition = (productData: {
        name?: string
        estimated_calories_per_100g?: number | null
        estimated_proteins_per_100g?: number | null
        estimated_fats_per_100g?: number | null
        estimated_carbs_per_100g?: number | null
        brand?: string | null
        category?: string | null
        barcode?: string | null
        description?: string | null
    }) => {
        setScannedProduct({
            id: '',
            name: productData.name || 'Неизвестный продукт',
            calories: productData.estimated_calories_per_100g || 0,
            proteins: productData.estimated_proteins_per_100g || 0,
            fats: productData.estimated_fats_per_100g || 0,
            carbs: productData.estimated_carbs_per_100g || 0,
            brand: productData.brand || undefined,
            category: productData.category || undefined,
            barcode: productData.barcode || undefined,
            source: 'ai_recognition',
            description: productData.description || undefined,
        })
    }

    const handleSubmitBarcode = async () => {
        if (!scannedProduct || !weight) { setError('Заполните все поля'); return }
        const weightValue = parseFloat(weight)
        if (isNaN(weightValue) || weightValue < 1 || weightValue > 10000) {
            toast.error('Вес должен быть от 1 до 10000 грамм')
            return
        }
        setIsLoading(true)
        setError(null)
        try {
            await nutritionAPI.createLogFromBarcode({ barcode: scannedProduct.barcode!, weight_g: weightValue, meal_type: mealType, eaten_at: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss") })
            toast.success('Приём пищи добавлен')
            onSuccess()
            handleClose()
        } catch (err: unknown) {
            const e = err as { response?: { data?: { detail?: string } } }
            const msg = e.response?.data?.detail || 'Ошибка при добавлении'
            setError(msg)
            toast.error(msg)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSubmitPhoto = async () => {
        if (!scannedProduct || !weight) { setError('Заполните все поля'); return }
        const weightValue = parseFloat(weight)
        if (isNaN(weightValue) || weightValue < 1 || weightValue > 10000) {
            toast.error('Вес должен быть от 1 до 10000 грамм')
            return
        }
        setIsLoading(true)
        setError(null)
        try {
            let productId = scannedProduct.id
            if (!productId) {
                const searchRes = await nutritionAPI.listProducts({ search: scannedProduct.name })
                const existing = searchRes.data?.find(p => p.name.toLowerCase() === scannedProduct.name.toLowerCase())
                if (existing) {
                    productId = existing.id
                } else {
                    const createRes = await nutritionAPI.createProductFromRecognition({
                        name: scannedProduct.name,
                        calories: scannedProduct.calories || 0,
                        proteins: scannedProduct.proteins || 0,
                        fats: scannedProduct.fats || 0,
                        carbs: scannedProduct.carbs || 0,
                        brand: scannedProduct.brand,
                        category: scannedProduct.category,
                        barcode: scannedProduct.barcode,
                    })
                    productId = createRes.data?.id
                }
            }
            await nutritionAPI.createLog({ product_id: productId, weight_g: weightValue, meal_type: mealType, eaten_at: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss") })
            toast.success('Приём пищи добавлен')
            onSuccess()
            handleClose()
        } catch (err: unknown) {
            const e = err as { response?: { data?: { detail?: string } }; message?: string }
            const msg = e.response?.data?.detail || e.message || 'Ошибка при добавлении'
            setError(msg)
            toast.error(msg)
        } finally {
            setIsLoading(false)
        }
    }

    const handleTextRecognize = async () => {
        if (!textInput.trim()) return
        setIsLoading(true)
        setError(null)
        try {
            const res = await nutritionAPI.recognizeProductFromText(textInput.trim())
            handlePhotoRecognition(res.data as Parameters<typeof handlePhotoRecognition>[0])
        } catch (err: unknown) {
            const e = err as { response?: { data?: { detail?: string } }; message?: string }
            setError(e.response?.data?.detail || e.message || 'Не удалось определить КБЖУ. Уточните название.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleClose = () => {
        setScannedProduct(null)
        setWeight('')
        setMealType('lunch')
        setError(null)
        setTextInput('')
        onClose()
    }

    const isBarcode = activeTab === 'barcode'

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Добавить приём пищи</DialogTitle>
                </DialogHeader>

                <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-2">
                    {([
                        { id: 'barcode', label: 'Штрихкод', icon: Barcode },
                        { id: 'photo',   label: 'По фото',  icon: ImageIcon },
                        { id: 'text',    label: 'По тексту', icon: Type },
                    ] as const).map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => { setActiveTab(id); setScannedProduct(null); setError(null) }}
                            className={cn(
                                'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all',
                                activeTab === id
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <Icon className="h-4 w-4" />{label}
                        </button>
                    ))}
                </div>

                {isLoading && !scannedProduct && (
                    <div className="flex flex-col items-center justify-center py-8 gap-3 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm">Поиск продукта...</p>
                    </div>
                )}

                {!scannedProduct && !isLoading && (
                    activeTab === 'barcode' ? (
                        <BarcodeScanner onScan={handleBarcodeScan} onClose={handleClose} />
                    ) : activeTab === 'photo' ? (
                        <PhotoRecognition onRecognize={handlePhotoRecognition} onClose={handleClose} />
                    ) : (

                        <div className="space-y-3 py-2">
                            <p className="text-sm text-muted-foreground">
                                Введите название блюда или продукта — ИИ определит КБЖУ автоматически.
                            </p>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Например: греческий салат, овсянка на молоке..."
                                    value={textInput}
                                    onChange={e => setTextInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleTextRecognize() }}
                                    className="rounded-xl flex-1"
                                    disabled={isLoading}
                                />
                                <button
                                    onClick={handleTextRecognize}
                                    disabled={!textInput.trim() || isLoading}
                                    className="px-4 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1.5"
                                >
                                    <Sparkles className="h-4 w-4" />
                                    Определить
                                </button>
                            </div>
                            {error && (
                                <div className="px-3 py-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-xl text-xs">
                                    {error}
                                </div>
                            )}
                            <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                                <p>• Чем точнее название — тем точнее результат</p>
                                <p>• Для готовых блюд указывайте способ приготовления</p>
                                <p>• КБЖУ являются приблизительными</p>
                            </div>
                        </div>
                    )
                )}

                {scannedProduct && (
                    <div className="space-y-4">
                        <ProductCard product={scannedProduct} />

                        <div className="space-y-1">
                            <label className="text-sm font-medium">Вес (граммы)</label>
                            <Input
                                type="number"
                                step="1"
                                min="1"
                                max="10000"
                                value={weight}
                                onChange={(e) => setWeight(e.target.value)}
                                placeholder="150"
                                className="rounded-xl"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Приём пищи</label>
                            <div className="grid grid-cols-4 gap-1.5">
                                {MEAL_TYPES.map(({ value, label }) => (
                                    <button
                                        key={value}
                                        onClick={() => setMealType(value)}
                                        className={cn(
                                            'py-2 text-xs font-medium rounded-xl border transition-all',
                                            mealType === value
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : 'border-input bg-background text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {error && (
                            <div className="px-3 py-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-xl text-xs">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => { setScannedProduct(null); setError(null) }}
                            >
                                <ArrowLeft className="h-4 w-4 mr-1.5" />Назад
                            </Button>
                            <Button
                                className="flex-1 rounded-xl"
                                onClick={isBarcode ? handleSubmitBarcode : handleSubmitPhoto}
                                disabled={isLoading || !weight}
                                isLoading={isLoading}
                            >
                                Добавить
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
