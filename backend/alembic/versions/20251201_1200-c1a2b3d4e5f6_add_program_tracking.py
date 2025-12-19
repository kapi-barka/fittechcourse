"""add_program_tracking

Revision ID: c1a2b3d4e5f6
Revises: ada7dc7ac356
Create Date: 2025-12-01 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c1a2b3d4e5f6'
down_revision: Union[str, None] = 'ada7dc7ac356'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add current program tracking to user_profiles
    op.add_column('user_profiles', sa.Column('current_program_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('user_profiles', sa.Column('current_program_start_date', sa.Date(), nullable=True))
    op.create_foreign_key('fk_user_profiles_program', 'user_profiles', 'programs', ['current_program_id'], ['id'], ondelete='SET NULL')

    # Create workout logs table
    op.create_table('workout_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('program_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('day_number', sa.Integer(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=True),
        sa.Column('notes', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['program_id'], ['programs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('workout_logs')
    op.drop_constraint('fk_user_profiles_program', 'user_profiles', type_='foreignkey')
    op.drop_column('user_profiles', 'current_program_start_date')
    op.drop_column('user_profiles', 'current_program_id')

