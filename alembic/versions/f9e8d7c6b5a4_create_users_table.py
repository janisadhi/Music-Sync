"""create_users_table

Revision ID: f9e8d7c6b5a4
Revises: e51922c09d1a
Create Date: 2026-08-08 00:20:00.000000

"""
from datetime import datetime, timezone
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from app.core.auth import hash_password

# revision identifiers, used by Alembic.
revision: str = 'f9e8d7c6b5a4'
down_revision: Union[str, Sequence[str], None] = 'e51922c09d1a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    users_table = op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("username", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    # Seed default admin user
    hashed_admin_password = hash_password("admin")
    now = datetime.now(timezone.utc)
    op.bulk_insert(
        users_table,
        [
            {
                "username": "admin",
                "password_hash": hashed_admin_password,
                "must_change_password": True,
                "created_at": now,
                "updated_at": now,
            }
        ],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_table("users")
