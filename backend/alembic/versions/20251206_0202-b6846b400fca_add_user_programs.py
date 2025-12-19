"""add_user_programs

Revision ID: b6846b400fca
Revises: 53df928e32aa
Create Date: 2025-12-06 02:02:17.016957

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b6846b400fca'
down_revision: Union[str, None] = '53df928e32aa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum type first
    # Note: verify if it already exists or not. safer to create it explicitly if it's new.
    # Postgres requires explicit Enum creation usually if using sa.Enum with name.
    
    op.create_table('user_programs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('program_id', sa.UUID(), nullable=False),
        sa.Column('status', sa.Enum('STARTED', 'SAVED', 'COMPLETED', name='programstatus'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('start_date', sa.DateTime(), nullable=True),
        sa.Column('last_interaction_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['program_id'], ['programs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_programs_id'), 'user_programs', ['id'], unique=False)
    op.create_index(op.f('ix_user_programs_program_id'), 'user_programs', ['program_id'], unique=False)
    op.create_index(op.f('ix_user_programs_user_id'), 'user_programs', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_user_programs_user_id'), table_name='user_programs')
    op.drop_index(op.f('ix_user_programs_program_id'), table_name='user_programs')
    op.drop_index(op.f('ix_user_programs_id'), table_name='user_programs')
    op.drop_table('user_programs')
    # Drop enum
    sa.Enum(name='programstatus').drop(op.get_bind())
