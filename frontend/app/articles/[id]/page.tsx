/**
 * Страница отдельной статьи
 */
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AuthGuard } from '@/components/AuthGuard'
import { Card, CardContent } from '@/components/ui/Card'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Article {
  id: string
  title: string
  excerpt?: string
  content: string
  tags?: string[]
  cover_image_url?: string
  created_at: string
  views_count: number
}

export default function ArticlePage() {
  const params = useParams()
  const articleId = params.id as string
  const [article, setArticle] = useState<Article | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchArticle()
  }, [articleId])

  const fetchArticle = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/articles?id=${articleId}`)
      if (res.ok) {
        const data = await res.json()
        setArticle(data)
      }
    } catch (error) {
      console.error('Error fetching article:', error)
    }
    setIsLoading(false)
  }

  if (isLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen">
          <main className="container mx-auto px-4 py-8">
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="mt-4 text-muted-foreground">Загрузка...</p>
            </div>
          </main>
        </div>
      </AuthGuard>
    )
  }

  if (!article) {
    return (
      <AuthGuard>
        <div className="min-h-screen">
          <main className="container mx-auto px-4 py-8">
            <Card className="border-0">
              <CardContent className="text-center py-12">
                <p className="text-lg font-medium mb-2">Статья не найдена</p>
                <Link href="/articles">
                  <button className="text-primary hover:underline">Вернуться к статьям</button>
                </Link>
              </CardContent>
            </Card>
          </main>
        </div>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <div className="min-h-screen">
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <Link href="/articles">
            <button className="flex items-center text-muted-foreground hover:text-foreground mb-6">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад к статьям
            </button>
          </Link>

          <Card className="border-0 bg-background/80 backdrop-blur-sm">
            <CardContent className="p-8">
              <article>
                <h1 className="text-4xl font-extrabold mb-4 text-foreground">
                  {article.title}
                </h1>
                
                {article.excerpt && (
                  <p className="text-lg text-muted-foreground mb-6">
                    {article.excerpt}
                  </p>
                )}

                <div
                  className="article-content"
                  dangerouslySetInnerHTML={{ __html: article.content }}
                />
              </article>
            </CardContent>
          </Card>
        </main>
      </div>
    </AuthGuard>
  )
}

