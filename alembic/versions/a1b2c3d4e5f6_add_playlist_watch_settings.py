"""add playlist watch settings

Revision ID: a1b2c3d4e5f6
Revises: f9e8d7c6b5a4
Create Date: 2026-08-09 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "f9e8d7c6b5a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "app_settings",
        sa.Column(
            "playlist_watch_mode",
            sa.String(20),
            nullable=False,
            server_default="whole",
        ),
    )

    op.add_column(
        "app_settings",
        sa.Column(
            "playlist_watch_limit",
            sa.Integer(),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("app_settings", "playlist_watch_limit")
    op.drop_column("app_settings", "playlist_watch_mode")
