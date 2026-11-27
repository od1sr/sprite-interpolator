"""Record real token grants and purchases in a payments table."""

from typing import Sequence
from uuid import uuid4

from alembic import op
import sqlalchemy as sa

revision: str = "0007_payment_history"
down_revision: str | None = "0006_processing_credits"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "payments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("plan", sa.String(32), nullable=False),
        sa.Column("amount_rub", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(16), nullable=False, server_default="paid"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_payments_user_id", "payments", ["user_id"], unique=False)
    op.create_index(
        "ix_payments_user_id_created_at", "payments", ["user_id", "created_at"], unique=False
    )

    # Existing users really did receive 300 tokens at registration.
    bind = op.get_bind()
    users = bind.execute(sa.text("SELECT id, created_at FROM users")).fetchall()
    payments = sa.table(
        "payments",
        sa.column("id", sa.UUID()),
        sa.column("user_id", sa.UUID()),
        sa.column("plan", sa.String(32)),
        sa.column("amount_rub", sa.Integer()),
        sa.column("tokens", sa.Integer()),
        sa.column("status", sa.String(16)),
        sa.column("created_at", sa.DateTime(timezone=True)),
    )
    for user_id, created_at in users:
        bind.execute(
            payments.insert().values(
                id=uuid4(),
                user_id=user_id,
                plan="free",
                amount_rub=0,
                tokens=300,
                status="free",
                created_at=created_at,
            )
        )


def downgrade() -> None:
    op.drop_index("ix_payments_user_id_created_at", table_name="payments")
    op.drop_index("ix_payments_user_id", table_name="payments")
    op.drop_table("payments")
