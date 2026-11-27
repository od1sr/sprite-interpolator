"""Add per-user plan and token balance."""

from typing import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0005_user_plan_and_tokens"
down_revision: str | None = "0004_users_and_ownership"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("plan", sa.String(32), nullable=False, server_default="free"),
    )
    op.add_column(
        "users",
        sa.Column("token_balance", sa.Integer(), nullable=False, server_default="300"),
    )


def downgrade() -> None:
    op.drop_column("users", "token_balance")
    op.drop_column("users", "plan")
