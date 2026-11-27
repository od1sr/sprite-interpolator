"""Add token costs and refund flags to jobs and exports."""

from typing import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0006_processing_credits"
down_revision: str | None = "0005_user_plan_and_tokens"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("credits_cost", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("jobs", sa.Column("credits_breakdown", sa.JSON(), nullable=True))
    op.add_column(
        "jobs",
        sa.Column("credits_refunded", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "export_jobs",
        sa.Column("credits_cost", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "export_jobs",
        sa.Column("credits_refunded", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("export_jobs", "credits_refunded")
    op.drop_column("export_jobs", "credits_cost")
    op.drop_column("jobs", "credits_refunded")
    op.drop_column("jobs", "credits_breakdown")
    op.drop_column("jobs", "credits_cost")
