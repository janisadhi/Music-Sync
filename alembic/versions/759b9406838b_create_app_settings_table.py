"""create app settings table

Revision ID: <KEEP_GENERATED_REVISION_ID>
Revises: 46e434edb2db
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "<KEEP_GENERATED_REVISION_ID>"
down_revision: Union[str, Sequence[str], None] = "46e434edb2db"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column(
            "id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "sync_interval_seconds",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "download_limit",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "lyrics_limit",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "youtube_playlist_url",
            sa.String(),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("app_settings")
