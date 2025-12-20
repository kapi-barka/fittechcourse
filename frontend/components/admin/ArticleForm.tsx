import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Article, uploadAPI } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { X, Plus, Loader2, Upload, FileText, Image as ImageIcon, Copy, Check } from 'lucide-react'
import { toast } from 'react-toastify'

interface ArticleFormProps {
  initialData?: Partial<Article>
  onSubmit: (data: Partial<Article>) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export const ArticleForm = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading
}: ArticleFormProps) => {
  const [formData, setFormData] = useState({
    title: '',
    html_file_name: '',
    html_file_url: '',
    excerpt: '',
    tags: [] as string[],
    cover_image_url: '',
    is_published: false
  })
  const [tagInput, setTagInput] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isUploadingHtml, setIsUploadingHtml] = useState(false)
  const [isUploadingImages, setIsUploadingImages] = useState(false)
  const [uploadedImages, setUploadedImages] = useState<Array<{ url: string; copied: boolean }>>([])

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        html_file_name: initialData.html_file_name || '',
        html_file_url: initialData.html_file_url || '',
        excerpt: initialData.excerpt || '',
        tags: initialData.tags || [],
        cover_image_url: initialData.cover_image_url || '',
        is_published: initialData.is_published || false
      })
    }
  }, [initialData])

  const handleChange = (field: string, value: string | boolean | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const addTag = () => {
    if (!tagInput.trim()) return
    if (formData.tags.length >= 5) {
      toast.warning('Можно добавить не более 5 тегов')
      return
    }
    if (formData.tags.includes(tagInput.trim())) {
      toast.warning('Тег уже добавлен')
      return
    }
    setFormData(prev => ({
      ...prev,
      tags: [...prev.tags, tagInput.trim()]
    }))
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }))
  }

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const res = await uploadAPI.uploadFile(file, 'articles')
      setFormData(prev => ({
        ...prev,
        cover_image_url: res.data.url
      }))
      toast.success('Обложка загружена')
    } catch (error) {
      console.error('Error uploading file:', error)
      toast.error('Ошибка при загрузке обложки')
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  const handleHtmlFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.html')) {
      toast.error('Файл должен иметь расширение .html')
      return
    }

    setIsUploadingHtml(true)
    try {
      const res = await uploadAPI.uploadFile(file, 'articles')
      setFormData(prev => ({
        ...prev,
        html_file_url: res.data.url,
        html_file_name: '' // Очищаем локальное имя, если загружаем на Cloudinary
      }))
      toast.success('HTML файл загружен на Cloudinary')
    } catch (error) {
      console.error('Error uploading HTML file:', error)
      toast.error('Ошибка при загрузке HTML файла')
    } finally {
      setIsUploadingHtml(false)
      e.target.value = ''
    }
  }

  const handleImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploadingImages(true)
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        if (!file.type.startsWith('image/')) {
          toast.warning(`Файл ${file.name} не является изображением`)
          return null
        }
        const res = await uploadAPI.uploadFile(file, 'articles/images')
        return { url: res.data.url, copied: false }
      })

      const results = await Promise.all(uploadPromises)
      const validResults = results.filter((r): r is { url: string; copied: boolean } => r !== null)
      
      setUploadedImages(prev => [...prev, ...validResults])
      toast.success(`Загружено ${validResults.length} изображений`)
    } catch (error) {
      console.error('Error uploading images:', error)
      toast.error('Ошибка при загрузке изображений')
    } finally {
      setIsUploadingImages(false)
      e.target.value = ''
    }
  }

  const copyImageUrl = async (url: string, index: number) => {
    try {
      await navigator.clipboard.writeText(url)
      setUploadedImages(prev => prev.map((img, i) => 
        i === index ? { ...img, copied: true } : img
      ))
      toast.success('URL изображения скопирован в буфер обмена')
      
      // Сбрасываем флаг через 2 секунды
      setTimeout(() => {
        setUploadedImages(prev => prev.map((img, i) => 
          i === index ? { ...img, copied: false } : img
        ))
      }, 2000)
    } catch {
      toast.error('Не удалось скопировать URL')
    }
  }

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Проверяем, что указан либо URL, либо имя файла
    if (!formData.html_file_url && !formData.html_file_name.trim()) {
      toast.error('Загрузите HTML файл или укажите имя локального файла')
      return
    }
    
    // Если указано имя файла, убеждаемся что оно заканчивается на .html
    let htmlFileName = formData.html_file_name
    if (htmlFileName && !htmlFileName.endsWith('.html')) {
      htmlFileName = `${htmlFileName}.html`
    }
    
    await onSubmit({
      ...formData,
      html_file_name: htmlFileName || undefined
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">Название статьи *</label>
        <Input
          placeholder="Введите название статьи"
          value={formData.title}
          onChange={(e) => handleChange('title', e.target.value)}
          required
          maxLength={300}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">HTML файл *</label>
        
        {/* Загрузка на Cloudinary */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".html,text/html"
              onChange={handleHtmlFileUpload}
              className="hidden"
              id="html-upload"
              disabled={isUploadingHtml}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById('html-upload')?.click()}
              disabled={isUploadingHtml}
              className="w-full"
            >
              {isUploadingHtml ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Загрузка...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {formData.html_file_url ? 'Изменить HTML файл' : 'Загрузить HTML файл на Cloudinary'}
                </>
              )}
            </Button>
          </div>
          
          {formData.html_file_url && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
              <p className="text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                HTML файл загружен на Cloudinary
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1 truncate">
                {formData.html_file_url}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleChange('html_file_url', '')}
                className="mt-2"
              >
                Удалить
              </Button>
            </div>
          )}
        </div>

        {/* Или указать локальный файл */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">или</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="article-name.html (локальный файл)"
            value={formData.html_file_name}
            onChange={(e) => handleChange('html_file_name', e.target.value)}
            disabled={!!formData.html_file_url}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {formData.html_file_url 
            ? 'Используется файл с Cloudinary. Очистите его, чтобы указать локальный файл.'
            : 'Имя файла HTML в папке frontend/articles/ (например: my-article.html)'}
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Краткое описание</label>
        <Textarea
          placeholder="Краткое описание статьи для превью..."
          value={formData.excerpt}
          onChange={(e) => handleChange('excerpt', e.target.value)}
          className="min-h-[100px]"
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground">
          {formData.excerpt.length}/500 символов
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Изображения для статьи</label>
        <p className="text-xs text-muted-foreground mb-2">
          Загрузите изображения, которые можно использовать в HTML статье. После загрузки скопируйте URL и вставьте его в ваш HTML файл.
        </p>
        
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImagesUpload}
            className="hidden"
            id="images-upload"
            disabled={isUploadingImages}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById('images-upload')?.click()}
            disabled={isUploadingImages}
            className="w-full"
          >
            {isUploadingImages ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Загрузка...
              </>
            ) : (
              <>
                <ImageIcon className="h-4 w-4 mr-2" />
                Загрузить изображения
              </>
            )}
          </Button>
        </div>

        {uploadedImages.length > 0 && (
          <div className="space-y-2 mt-4">
            <p className="text-sm font-medium">Загруженные изображения:</p>
            <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2">
              {uploadedImages.map((img, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-2 bg-muted rounded-md border hover:bg-muted/80 transition-colors"
                >
                  <Image
                    src={img.url}
                    alt={`Uploaded ${index + 1}`}
                    width={64}
                    height={64}
                    className="w-16 h-16 object-cover rounded border"
                    unoptimized
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate font-mono">
                      {img.url}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Используйте этот URL в теге &lt;img src=&quot;...&quot;&gt;
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => copyImageUrl(img.url, index)}
                      title="Копировать URL"
                      className={img.copied ? 'text-green-600' : ''}
                    >
                      {img.copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeImage(index)}
                      title="Удалить"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Теги</label>
        <div className="flex gap-2">
          <Input
            placeholder="Добавить тег"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag()
              }
            }}
            disabled={formData.tags.length >= 5}
          />
          <Button 
            type="button" 
            onClick={addTag} 
            variant="secondary"
            disabled={formData.tags.length >= 5}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {formData.tags.length}/5 тегов {formData.tags.length >= 5 && '(максимум достигнут)'}
        </p>
        {formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.tags.map((tag, index) => (
              <div
                key={index}
                className="bg-primary/10 text-primary px-2 py-1 rounded-md text-sm flex items-center"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-2 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Обложка статьи</label>
        {formData.cover_image_url && (
          <div className="mb-2">
            <Image
              src={formData.cover_image_url}
              alt="Cover"
              width={600}
              height={200}
              className="w-full max-w-md h-48 object-cover rounded-lg border"
              unoptimized
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/*"
            onChange={handleCoverImageUpload}
            className="hidden"
            id="cover-upload"
            disabled={isUploading}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById('cover-upload')?.click()}
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
                {formData.cover_image_url ? 'Изменить обложку' : 'Загрузить обложку'}
              </>
            )}
          </Button>
          {formData.cover_image_url && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleChange('cover_image_url', '')}
            >
              Удалить
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="is_published"
          checked={formData.is_published}
          onChange={(e) => handleChange('is_published', e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="is_published" className="text-sm font-medium">
          Опубликовать статью
        </label>
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

