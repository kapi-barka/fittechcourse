/**
 * Модальное окно для редактирования записи питания
 */
'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { nutritionAPI, NutritionLog, FoodProduct } from '@/lib/api'
import { Loader2, Apple } from 'lucide-react'
import { toast } from 'react-toastify'

interface EditLogModalProps {
  isOpen: boolean
  onClose: () => void
  log: NutritionLog | null
  onSuccess: () => void
}

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export function EditLogModal({ isOpen, onClose, log, onSuccess }: EditLogModalProps) {
  const [formData, setFormData] = useState({
    weight_g: '',
    meal_type: 'lunch' as MealType,
  })
  const [products, setProducts] = useState<FoodProduct[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    if (log) {
      setFormData({
        weight_g: log.weight_g?.toString() || '',
        meal_type: (log.meal_type as MealType) || 'lunch',
      })
      setSelectedProductId(log.product_id)
    }
  }, [log])

  useEffect(() => {
    if (searchQuery.length > 2) {
      const timeoutId = setTimeout(() => {
        searchProducts()
      }, 500)
      return () => clearTimeout(timeoutId)
    } else {
      setProducts([])
    }
  }, [searchQuery])

  const searchProducts = async () => {
    setIsSearching(true)
    try {
      const response = await nutritionAPI.listProducts({ search: searchQuery })
      setProducts(response.data || [])
    } catch (error) {
      console.error('Error searching products:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!log) return

    if (!selectedProductId) {
      toast.error('Выберите продукт')
      return
    }

    if (!formData.weight_g || parseFloat(formData.weight_g) <= 0) {
      toast.error('Введите вес порции')
      return
    }

    setIsLoading(true)
    try {
      const updateData: Partial<NutritionLog> = {
        product_id: selectedProductId,
        weight_g: parseFloat(formData.weight_g),
        meal_type: formData.meal_type,
      }

      await nutritionAPI.updateLog(log.id, updateData)
      onSuccess()
      onClose()
      toast.success('Запись обновлена')
    } catch (error) {
      console.error('Error updating log:', error)
      toast.error('Ошибка при обновлении записи')
    } finally {
      setIsLoading(false)
    }
  }

  if (!log) return null

  const getSelectedProduct = () => {
    if (selectedProductId && products.length > 0) {
      return products.find(p => p.id === selectedProductId)
    }
    if (log.product_name) {
      return { id: log.product_id, name: log.product_name } as FoodProduct
    }
    return null
  }

  const selectedProduct = getSelectedProduct()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Apple className="h-5 w-5" />
            Редактировать запись питания
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Продукт</label>
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (!e.target.value) {
                  setProducts([])
                }
              }}
              placeholder={selectedProduct?.name || "Поиск продукта..."}
            />
            {isSearching && (
              <p className="text-xs text-muted-foreground">Поиск...</p>
            )}
            {products.length > 0 && (
              <div className="border rounded-lg max-h-40 overflow-y-auto">
                {products.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => {
                      setSelectedProductId(product.id)
                      setSearchQuery(product.name)
                      setProducts([])
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors ${
                      selectedProductId === product.id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="font-medium">{product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {product.calories} ккал/100г • Б: {product.proteins}г Ж: {product.fats}г У: {product.carbs}г
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedProduct && !searchQuery && (
              <p className="text-xs text-muted-foreground">
                Выбран: {selectedProduct.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Вес порции (г)</label>
            <Input
              type="number"
              name="weight_g"
              value={formData.weight_g}
              onChange={(e) => setFormData(prev => ({ ...prev, weight_g: e.target.value }))}
              placeholder="100"
              step="1"
              min="1"
              max="10000"
              required
            />
            <p className="text-xs text-muted-foreground">От 1 до 10000 г</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Тип приема пищи</label>
            <select
              value={formData.meal_type}
              onChange={(e) => setFormData(prev => ({ ...prev, meal_type: e.target.value as MealType }))}
              className="w-full px-3 py-2 border rounded-md bg-background"
            >
              <option value="breakfast">Завтрак</option>
              <option value="lunch">Обед</option>
              <option value="dinner">Ужин</option>
              <option value="snack">Перекус</option>
            </select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isLoading}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isLoading || !selectedProductId}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : (
                'Сохранить'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

