"""Link export jobs to processing jobs."""

from typing import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0003_link_export_jobs_to_jobs"
down_revision: str | None = "0002_export_jobs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("export_jobs", sa.Column("job_id", sa.Uuid(), nullable=True))
    op.execute(
        """
        UPDATE export_jobs
        SET job_id = (
            SELECT jobs.id
            FROM jobs
            WHERE jobs.video_id = export_jobs.video_id
            ORDER BY jobs.created_at DESC, jobs.id DESC
            LIMIT 1
        )
        """
    )
    op.create_index("ix_export_jobs_job_id", "export_jobs", ["job_id"], unique=False)
    op.create_foreign_key(
        "fk_export_jobs_job_id_jobs",
        "export_jobs",
        "jobs",
        ["job_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_export_jobs_job_id_jobs", "export_jobs", type_="foreignkey")
    op.drop_index("ix_export_jobs_job_id", table_name="export_jobs")
    op.drop_column("export_jobs", "job_id")
