import { NextResponse } from 'next/server'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    const articlesDir = join(process.cwd(), 'articles')
    const articlesJsonPath = join(articlesDir, 'articles.json')
    
    // Читаем метаданные статей
    const articlesJson = JSON.parse(readFileSync(articlesJsonPath, 'utf-8'))
    
    if (id) {
      // Возвращаем конкретную статью
      const article = articlesJson.find((a: any) => a.id === id)
      if (!article) {
        return NextResponse.json({ error: 'Article not found' }, { status: 404 })
      }
      
      // Читаем HTML контент
      const htmlPath = join(articlesDir, `${id}.html`)
      try {
        const htmlContent = readFileSync(htmlPath, 'utf-8')
        return NextResponse.json({
          ...article,
          content: htmlContent
        })
      } catch {
        return NextResponse.json({ error: 'Article content not found' }, { status: 404 })
      }
    } else {
      // Возвращаем список статей
      return NextResponse.json(articlesJson)
    }
  } catch (error) {
    console.error('Error reading articles:', error)
    return NextResponse.json({ error: 'Failed to read articles' }, { status: 500 })
  }
}

