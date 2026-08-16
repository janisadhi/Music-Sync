"""add metadata settings to app_settings

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-08-16 14:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'app_settings',
        sa.Column('auto_scan_metadata_enabled', sa.Boolean(), server_default='true', nullable=False)
    )
    op.add_column(
        'app_settings',
        sa.Column('auto_rename_files', sa.Boolean(), server_default='true', nullable=False)
    )
    op.add_column(
        'app_settings',
        sa.Column('min_confidence_threshold', sa.String(length=20), server_default='MEDIUM', nullable=False)
    )
    op.add_column(
        'app_settings',
        sa.Column('clean_youtube_titles', sa.Boolean(), server_default='true', nullable=False)
    )


def downgrade() -> None:
    op.drop_column('app_settings', 'clean_youtube_titles')
    op.drop_column('app_settings', 'min_confidence_threshold')
    op.drop_column('app_settings', 'auto_rename_files')
    op.drop_column('app_settings', 'auto_scan_metadata_enabled')
