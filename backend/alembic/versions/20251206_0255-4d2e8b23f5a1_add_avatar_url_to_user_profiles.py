"""add_avatar_url_to_user_profiles

Revision ID: 4d2e8b23f5a1
Revises: b6846b400fca
Create Date: 2025-12-06 02:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4d2e8b23f5a1'
down_revision: Union[str, None] = 'b6846b400fca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user_profiles', sa.Column('avatar_url', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('user_profiles', 'avatar_url')
