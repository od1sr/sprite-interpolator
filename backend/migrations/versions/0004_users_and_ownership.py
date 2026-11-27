"""Add users and per-user ownership."""

from typing import Sequence
from uuid import uuid4

from alembic import op
import sqlalchemy as sa

revision: str = "0004_users_and_ownership"
down_revision: str | None = "0003_link_export_jobs_to_jobs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OWNED_TABLES = ("videos", "jobs", "results", "export_jobs")


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("username", sa.String(64), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("username", name="uq_users_username"),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    for table in OWNED_TABLES:
        op.add_column(table, sa.Column("user_id", sa.Uuid(), nullable=True))

    legacy_id = str(uuid4())
    op.execute(
        f"""
        INSERT INTO users (id, username, password_hash, created_at)
        VALUES ('{legacy_id}', 'legacy', '!', now())
        """
    )
    for table in OWNED_TABLES:
        op.execute(f"UPDATE {table} SET user_id = '{legacy_id}' WHERE user_id IS NULL")
        op.alter_column(table, "user_id", existing_type=sa.Uuid(), nullable=False)
        op.create_index(f"ix_{table}_user_id", table, ["user_id"], unique=False)
        op.create_foreign_key(
            f"fk_{table}_user_id_users",
            table,
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )

    op.create_index("ix_videos_user_id_created_at", "videos", ["user_id", "created_at"], unique=False)
    op.create_index("ix_jobs_user_id_created_at", "jobs", ["user_id", "created_at"], unique=False)
    op.create_index("ix_export_jobs_user_id_created_at", "export_jobs", ["user_id", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_export_jobs_user_id_created_at", table_name="export_jobs")
    op.drop_index("ix_jobs_user_id_created_at", table_name="jobs")
    op.drop_index("ix_videos_user_id_created_at", table_name="videos")

    for table in OWNED_TABLES:
        op.drop_constraint(f"fk_{table}_user_id_users", table, type_="foreignkey")
        op.drop_index(f"ix_{table}_user_id", table_name=table)
        op.drop_column(table, "user_id")

    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
