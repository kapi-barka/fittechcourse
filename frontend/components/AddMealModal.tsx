/**
 * Модальное окно для добавления приема пищи
 * Поддерживает сканирование штрихкода и поиск в базе
 */
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { BarcodeScanner } from './BarcodeScanner'
import { PhotoRecognition } from './PhotoRecognition'
import { nutritionAPI, FoodProduct } from '@/lib/api'
import { Barcode, Loader2, Image as ImageIcon } from 'lucide-react'
import { toast } from 'react-toastify'

interface AddMealModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export function AddMealModal({ isOpen, onClose, onSuccess }: AddMealModalProps) {
    const [activeTab, setActiveTab] = useState<'barcode' | 'photo'>('barcode')
    const [scannedProduct, setScannedProduct] = useState<FoodProduct | null>(null)
    const [weight, setWeight] = useState('')
    const [mealType, setMealType] = useState<MealType>('lunch')
    const [notes, setNotes] = useState('')
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
                setError('Продукт не найден в базе данных. Попробуйте добавить его вручную.')
            }
        } catch (err: unknown) {
            const error = err as { response?: { data?: { detail?: string } }; message?: string }
            const errorDetail = error.response?.data?.detail || error.message || ''
            const errorMessage = errorDetail.includes('не найден') 
                ? 'Продукт не найден в базе данных. Попробуйте добавить его вручную через вкладку "Поиск".'
                : errorDetail || 'Ошибка при поиске продукта. Попробуйте еще раз.'
            setError(errorMessage)
            // Сбрасываем состояние сканирования, чтобы можно было попробовать снова
            setTimeout(() => {
                setError(null)
            }, 8000)
        } finally {
            setIsLoading(false)
        }
    }

    const handlePhotoRecognition = async (productData: {
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
        setIsLoading(true)
        setError(null)

        try {
            // Преобразуем данные распознавания в формат FoodProduct
            const product: FoodProduct = {
                id: '', // Временный ID
                name: productData.name || 'Неизвестный продукт',
                calories: productData.estimated_calories_per_100g || 0,
                proteins: productData.estimated_proteins_per_100g || 0,
                fats: productData.estimated_fats_per_100g || 0,
                carbs: productData.estimated_carbs_per_100g || 0,
                brand: productData.brand || undefined,
                category: productData.category || undefined,
                barcode: productData.barcode || undefined,
                source: 'ai_recognition',
                description: productData.description || undefined
            }
            
            setScannedProduct(product)
        } catch (err: unknown) {
            const error = err as { response?: { data?: { detail?: string } }; message?: string }
            const errorDetail = error.response?.data?.detail || error.message || ''
            setError(errorDetail || 'Ошибка при распознавании продукта. Попробуйте еще раз.')
            setTimeout(() => {
                setError(null)
            }, 8000)
        } finally {
            setIsLoading(false)
        }
    }

    const handlePhotoSubmit = async () => {
        if (!scannedProduct || !weight) {
            setError('Заполните все поля')
            return
        }

        const weightValue = parseFloat(weight)
        if (isNaN(weightValue) || weightValue < 1 || weightValue > 10000) {
            setError('Вес продукта должен быть от 1 до 10000 грамм')
            toast.error('Вес продукта должен быть от 1 до 10000 грамм')
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            // Сначала пытаемся найти продукт в базе
            let productId = scannedProduct.id
            
            if (!productId || productId === '') {
                try {
                    // Ищем продукт в базе по названию
                    const searchResponse = await nutritionAPI.listProducts({ search: scannedProduct.name })
                    const existingProduct = searchResponse.data?.find(
                        p => p.name.toLowerCase() === scannedProduct.name.toLowerCase()
                    )
                    
                    if (existingProduct) {
                        productId = existingProduct.id
                    } else {
                        // Если не нашли, создаем новый продукт через специальный endpoint
                        const createResponse = await nutritionAPI.createProductFromRecognition({
                            name: scannedProduct.name,
                            calories: scannedProduct.calories || 0,
                            proteins: scannedProduct.proteins || 0,
                            fats: scannedProduct.fats || 0,
                            carbs: scannedProduct.carbs || 0,
                            brand: scannedProduct.brand || undefined,
                            category: scannedProduct.category || undefined,
                            barcode: scannedProduct.barcode || undefined
                        })
                        
                        if (createResponse.data) {
                            productId = createResponse.data.id
                        }
                    }
                } catch {
                    throw new Error('Ошибка при поиске/создании продукта. Попробуйте еще раз.')
                }
            }

            // Создаем запись в дневнике
            await nutritionAPI.createLog({
                product_id: productId,
                weight_g: parseFloat(weight),
                meal_type: mealType,
                notes: notes || undefined
            })

            // Успех - закрываем модалку и обновляем список
            toast.success('Прием пищи успешно добавлен')
            onSuccess()
            handleClose()
        } catch (err: unknown) {
            const error = err as { response?: { data?: { detail?: string } }; message?: string }
            const errorMsg = error.response?.data?.detail || error.message || 'Ошибка при добавлении'
            setError(errorMsg)
            toast.error(errorMsg)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSubmit = async () => {
        if (!scannedProduct || !weight) {
            setError('Заполните все поля')
            return
        }

        const weightValue = parseFloat(weight)
        if (isNaN(weightValue) || weightValue < 1 || weightValue > 10000) {
            setError('Вес продукта должен быть от 1 до 10000 грамм')
            toast.error('Вес продукта должен быть от 1 до 10000 грамм')
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            await nutritionAPI.createLogFromBarcode({
                barcode: scannedProduct.barcode!,
                weight_g: parseFloat(weight),
                meal_type: mealType,
                notes: notes || undefined
            })

            // Успех - закрываем модалку и обновляем список
            toast.success('Прием пищи успешно добавлен')
            onSuccess()
            handleClose()
        } catch (err: unknown) {
            const error = err as { response?: { data?: { detail?: string } } }
            const errorMsg = error.response?.data?.detail || 'Ошибка при добавлении'
            setError(errorMsg)
            toast.error(errorMsg)
        } finally {
            setIsLoading(false)
        }
    }

    const handleClose = () => {
        setScannedProduct(null)
        setWeight('')
        setMealType('lunch')
        setNotes('')
        setError(null)
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-md max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Добавить приём пищи</DialogTitle>
                </DialogHeader>

                {/* Табы */}
                <div className="flex space-x-2 mb-6 border-b">
                    <button
                        onClick={() => setActiveTab('barcode')}
                        className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'barcode'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <Barcode className="inline-block mr-2 h-4 w-4" />
                        Штрихкод
                    </button>
                    <button
                        onClick={() => setActiveTab('photo')}
                        className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'photo'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <ImageIcon className="inline-block mr-2 h-4 w-4" />
                        По фото
                    </button>
                </div>

                {/* Контент вкладки Штрихкод */}
                {activeTab === 'barcode' && (
                    <div className="space-y-4">
                        {!scannedProduct ? (
                            <BarcodeScanner
                                onScan={handleBarcodeScan}
                                onClose={handleClose}
                            />
                        ) : (
                            <>
                                {/* Информация о продукте */}
                                <div className="p-4 bg-muted rounded-lg">
                                    <h4 className="font-semibold mb-2">{scannedProduct.name}</h4>
                                    {scannedProduct.brand && (
                                        <p className="text-sm text-muted-foreground mb-2">{scannedProduct.brand}</p>
                                    )}
                                    <div className="grid grid-cols-4 gap-2 text-sm">
                                        <div>
                                            <div className="text-muted-foreground">Калории</div>
                                            <div className="font-semibold">{scannedProduct.calories}</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground">Белки</div>
                                            <div className="font-semibold">{scannedProduct.proteins}г</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground">Жиры</div>
                                            <div className="font-semibold">{scannedProduct.fats}г</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground">Углев.</div>
                                            <div className="font-semibold">{scannedProduct.carbs}г</div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">на 100г</p>
                                </div>

                                {/* Форма ввода данных */}
                                <div>
                                <Input
                                    label="Вес (граммы)"
                                    type="number"
                                    step="0.1"
                                    value={weight}
                                    onChange={(e) => setWeight(e.target.value)}
                                    placeholder="150"
                                        min="1"
                                        max="10000"
                                    required
                                />
                                    <p className="text-xs text-muted-foreground mt-1">От 1 до 10000 грамм</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Тип приёма пищи</label>
                                    <select
                                        value={mealType}
                                        onChange={(e) => setMealType(e.target.value as MealType)}
                                        className="w-full px-3 py-2 border rounded-lg bg-background"
                                    >
                                        <option value="breakfast">Завтрак</option>
                                        <option value="lunch">Обед</option>
                                        <option value="dinner">Ужин</option>
                                        <option value="snack">Перекус</option>
                                    </select>
                                </div>

                                <Input
                                    label="Заметки (опционально)"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Например: без соли"
                                />

                                {error && (
                                    <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-lg text-sm">
                                        {error}
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <Button
                                        onClick={() => setScannedProduct(null)}
                                        variant="outline"
                                        className="flex-1"
                                    >
                                        Назад
                                    </Button>
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={isLoading || !weight}
                                        className="flex-1"
                                    >
                                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Добавить
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Контент вкладки По фото */}
                {activeTab === 'photo' && (
                    <div className="space-y-4">
                        {!scannedProduct ? (
                            <PhotoRecognition
                                onRecognize={handlePhotoRecognition}
                                onClose={handleClose}
                            />
                        ) : (
                            <>
                                {/* Информация о продукте */}
                                <div className="p-4 bg-muted rounded-lg">
                                    <h4 className="font-semibold mb-2">{scannedProduct.name}</h4>
                                    {scannedProduct.brand && (
                                        <p className="text-sm text-muted-foreground mb-2">{scannedProduct.brand}</p>
                                    )}
                                    {scannedProduct.description && (
                                        <p className="text-sm text-muted-foreground mb-2">{scannedProduct.description}</p>
                                    )}
                                    <div className="grid grid-cols-4 gap-2 text-sm">
                                        <div>
                                            <div className="text-muted-foreground">Калории</div>
                                            <div className="font-semibold">{scannedProduct.calories || '—'}</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground">Белки</div>
                                            <div className="font-semibold">{scannedProduct.proteins || '—'}г</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground">Жиры</div>
                                            <div className="font-semibold">{scannedProduct.fats || '—'}г</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground">Углев.</div>
                                            <div className="font-semibold">{scannedProduct.carbs || '—'}г</div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">на 100г</p>
                                </div>

                                {/* Форма ввода данных */}
                                <div>
                                <Input
                                    label="Вес (граммы)"
                                    type="number"
                                    step="0.1"
                                    value={weight}
                                    onChange={(e) => setWeight(e.target.value)}
                                    placeholder="150"
                                        min="1"
                                        max="10000"
                                    required
                                />
                                    <p className="text-xs text-muted-foreground mt-1">От 1 до 10000 грамм</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Тип приёма пищи</label>
                                    <select
                                        value={mealType}
                                        onChange={(e) => setMealType(e.target.value as MealType)}
                                        className="w-full px-3 py-2 border rounded-lg bg-background"
                                    >
                                        <option value="breakfast">Завтрак</option>
                                        <option value="lunch">Обед</option>
                                        <option value="dinner">Ужин</option>
                                        <option value="snack">Перекус</option>
                                    </select>
                                </div>

                                <Input
                                    label="Заметки (опционально)"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Например: без соли"
                                />

                                {error && (
                                    <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-lg text-sm">
                                        {error}
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <Button
                                        onClick={() => setScannedProduct(null)}
                                        variant="outline"
                                        className="flex-1"
                                    >
                                        Назад
                                    </Button>
                                    <Button
                                        onClick={handlePhotoSubmit}
                                        disabled={isLoading || !weight}
                                        className="flex-1"
                                    >
                                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Добавить
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                )}

            </DialogContent>
        </Dialog>
    )
}
