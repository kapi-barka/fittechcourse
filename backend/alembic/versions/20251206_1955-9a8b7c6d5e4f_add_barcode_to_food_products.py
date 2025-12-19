"""Add barcode and source fields to food products

Revision ID: 9a8b7c6d5e4f
Revises: 4d2e8b23f5a1
Create Date: 2025-12-06 19:55:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '9a8b7c6d5e4f'
down_revision = '4d2e8b23f5a1'
branch_labels = None
depends_on = None


def upgrade():
    # Добавляем новые поля в food_products
    op.add_column('food_products', sa.Column('barcode', sa.String(), nullable=True))
    op.add_column('food_products', sa.Column('source', sa.String(), nullable=True))
    op.add_column('food_products', sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True))
    
    # Создаем индексы
    op.create_index('ix_food_products_barcode', 'food_products', ['barcode'], unique=True)
    
    # Добавляем FK для пользовательских продуктов
    op.create_foreign_key(
        'fk_food_products_user',
        'food_products', 'users',
        ['user_id'], ['id'],
        ondelete='CASCADE'
    )


def downgrade():
    # Удаляем FK
    op.drop_constraint('fk_food_products_user', 'food_products', type_='foreignkey')
    
    # Удаляем индексы
    op.drop_index('ix_food_products_barcode', 'food_products')
    
    # Удаляем колонки
    op.drop_column('food_products', 'user_id')
    op.drop_column('food_products', 'source')
    op.drop_column('food_products', 'barcode')
