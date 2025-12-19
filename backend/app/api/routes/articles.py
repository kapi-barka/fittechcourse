"""
API роутер для статей
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import List
from uuid import UUID

from app.db.database import get_db
from app.core.dependencies import get_current_active_user, require_admin
from app.models.article import Article
from app.models.user import User
from app.schemas.article import ArticleCreate, ArticleUpdate, ArticleResponse

router = APIRouter()


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
        query = query.where(
            or_(
                Article.title.ilike(f"%{search}%"),
                Article.content.ilike(f"%{search}%")
            )
        )
    
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
    
    # Увеличиваем счетчик просмотров
    article.views_count += 1
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

