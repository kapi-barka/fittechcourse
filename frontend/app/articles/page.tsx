/**
 * Страница статей
 */
'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { AuthGuard } from '@/components/AuthGuard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import {
  BookOpen,
  Search,
  Eye,
  Calendar,
  Tag
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

interface LocalArticle {
  id: string
  title: string
  excerpt?: string
  tags?: string[]
  cover_image_url?: string
  created_at: string
  views_count: number
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<LocalArticle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchArticles()
  }, [])

  const fetchArticles = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/articles')
      if (res.ok) {
        const data = await res.json()
        setArticles(data)
      }
    } catch (error) {
      console.error('Error fetching articles:', error)
    }
    setIsLoading(false)
  }

  const filteredArticles = articles.filter(article =>
    article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    article.excerpt?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <AuthGuard>
      <div className="min-h-screen">

        <main className="container mx-auto px-4 py-8">
          {/* Поиск */}
          <div className="mb-8">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Поиск статей..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Список статей */}
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="mt-4 text-muted-foreground">Загрузка...</p>
            </div>
          ) : filteredArticles.length === 0 ? (
            <Card className="border-0">
              <CardContent className="text-center py-12">
                <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Статьи не найдены</p>
                <p className="text-muted-foreground">
                  {searchQuery ? 'Попробуйте изменить запрос' : 'Статьи скоро появятся'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredArticles.map((article) => (
                <Link key={article.id} href={`/articles/${article.id}`}>
                  <Card className="hover:shadow-lg transition-all cursor-pointer h-full border-0">
                    {article.cover_image_url && (
                      <div className="h-48 overflow-hidden rounded-t-lg">
                        <Image
                          src={article.cover_image_url}
                          alt={article.title}
                          width={400}
                          height={200}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle className="line-clamp-2">{article.title}</CardTitle>
                      <CardDescription className="line-clamp-3">
                        {article.excerpt || ''}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          {formatDate(article.created_at)}
                        </div>
                        <div className="flex items-center">
                          <Eye className="h-4 w-4 mr-1" />
                          {article.views_count}
                        </div>
                      </div>
                      {article.tags && article.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {article.tags.slice(0, 3).map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary"
                            >
                              <Tag className="h-3 w-3 mr-1" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  )
}

