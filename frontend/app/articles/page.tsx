
'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { AuthGuard } from '@/components/AuthGuard'
import { Input } from '@/components/ui/Input'
import {
  BookOpen,
  Search,
  Eye,
  Calendar,
  Tag,
  Loader2,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { articlesAPI, Article } from '@/lib/api'

function ArticleCard({ article }: { article: Article }) {
  return (
    <Link href={`/articles/${article.id}`}>
      <div className="group relative rounded-2xl overflow-hidden cursor-pointer h-64 hover:ring-2 hover:ring-primary/40 transition-all duration-200 shadow-md">

        {article.cover_image_url ? (
          <Image
            src={article.cover_image_url}
            alt={article.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/60 to-primary/90" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

        {article.tags && article.tags.length > 0 && (
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            {article.tags.slice(0, 2).map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-primary/80 text-white"
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-3.5">
          <p className="text-white font-semibold text-sm leading-snug line-clamp-2 mb-2">
            {article.title}
          </p>
          {article.excerpt && (
            <p className="text-white/60 text-[11px] line-clamp-2 mb-2">
              {article.excerpt}
            </p>
          )}
          <div className="flex items-center justify-between text-white/50 text-[11px]">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(article.created_at)}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {article.views_count}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchArticles()
  }, [])

  const fetchArticles = async () => {
    setIsLoading(true)
    try {
      const res = await articlesAPI.list({ published_only: true })
      setArticles(res.data)
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
        <main className="container mx-auto px-4 py-4 sm:py-8">

          <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <BookOpen className="h-7 w-7 text-primary" />
              Статьи
            </h1>
          </div>

          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск статей..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 rounded-xl"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-white/10">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h2 className="text-lg font-semibold mb-2">Статьи не найдены</h2>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'Попробуйте изменить запрос' : 'Статьи скоро появятся'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {filteredArticles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          )}

        </main>
      </div>
    </AuthGuard>
  )
}
