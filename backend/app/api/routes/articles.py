"""
API роутер для статей
"""
import os
from pathlib import Path
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, text
from typing import List
from uuid import UUID

from app.db.database import get_db
from app.core.dependencies import get_current_active_user, require_admin
from app.models.article import Article
from app.models.user import User
from app.schemas.article import ArticleCreate, ArticleUpdate, ArticleResponse

router = APIRouter()

# Путь к папке со статьями (относительно корня проекта)
# От backend/app/api/routes/articles.py до frontend/articles
ARTICLES_DIR = Path(__file__).parent.parent.parent.parent.parent / "frontend" / "articles"


@router.get("/", response_model=List[ArticleResponse])
async def list_articles(
    skip: int = 0,
    limit: int = 50,
    search: str = None,
    tag: str = None,
    published_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получить список статей с фильтрацией
    """
    query = select(Article)
    
    # Обычные пользователи видят только опубликованные
    if published_only and current_user.role.value != "admin":
        query = query.where(Article.is_published == True)
    
    if search:
        conditions = [Article.title.ilike(f"%{search}%")]
        # Ищем в excerpt
        conditions.append(Article.excerpt.isnot(None) & Article.excerpt.ilike(f"%{search}%"))
        # Ищем в тегах - используем unnest для развертывания массива и поиска в каждом элементе
        search_lower = search.lower()
        # Используем raw SQL с правильным синтаксисом PostgreSQL для поиска в массиве
        # unnest разворачивает массив в строки, затем ищем подстроку в каждом элементе
        tag_condition = text(
            "EXISTS (SELECT 1 FROM unnest(articles.tags) AS tag WHERE LOWER(tag::text) LIKE :pattern)"
        ).bindparams(pattern=f"%{search_lower}%")
        conditions.append(Article.tags.isnot(None) & tag_condition)
        query = query.where(or_(*conditions))
    
    if tag:
        query = query.where(Article.tags.contains([tag]))
    
    query = query.order_by(Article.created_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    articles = result.scalars().all()
    
    return articles


@router.get("/{article_id}", response_model=ArticleResponse)
async def get_article(
    article_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получить статью по ID и увеличить счетчик просмотров
    Если у статьи есть html_file_name, читаем контент из файла
    """
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Статья не найдена"
        )
    
    # Проверка прав доступа к неопубликованным статьям
    if not article.is_published and current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Статья не опубликована"
        )
    
    # Читаем контент из HTML файла
    # Приоритет: сначала Cloudinary, потом локальный файл
    if article.html_file_url:
        # Читаем из Cloudinary
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(article.html_file_url)
                if response.status_code == 200:
                    article.content = response.text
                else:
                    article.content = None
        except Exception as e:
            print(f"Error fetching HTML from Cloudinary: {e}")
            article.content = None
    elif article.html_file_name:
        # Читаем из локального файла
        html_path = ARTICLES_DIR / article.html_file_name
        if html_path.exists():
            try:
                article.content = html_path.read_text(encoding='utf-8')
            except Exception as e:
                article.content = None
        else:
            article.content = None
    else:
        article.content = None
    
    # Добавляем пользователя в список просмотревших (если его там еще нет)
    if article.viewed_by is None:
        article.viewed_by = []
    
    # Проверяем, есть ли пользователь в списке
    if current_user.id not in article.viewed_by:
        # Создаем новый массив с добавленным пользователем (SQLAlchemy отслеживает изменения только при переприсваивании)
        new_viewed_by = list(article.viewed_by) if article.viewed_by else []
        new_viewed_by.append(current_user.id)
        article.viewed_by = new_viewed_by
        await db.commit()
        await db.refresh(article)
    
    return article


@router.post("/", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
async def create_article(
    article_data: ArticleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Создать новую статью (только администраторы)
    """
    article = Article(
        **article_data.model_dump(),
        author_id=current_user.id
    )
    
    db.add(article)
    await db.commit()
    await db.refresh(article)
    
    return article


@router.put("/{article_id}", response_model=ArticleResponse)
async def update_article(
    article_id: UUID,
    article_data: ArticleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Обновить статью (только администраторы)
    """
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Статья не найдена"
        )
    
    # Обновляем только переданные поля
    update_data = article_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(article, field, value)
    
    await db.commit()
    await db.refresh(article)
    
    return article


@router.delete("/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_article(
    article_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Удалить статью (только администраторы)
    """
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Статья не найдена"
        )
    
    await db.delete(article)
    await db.commit()
    
    return None

