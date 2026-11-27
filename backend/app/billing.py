"""Token charging and refunds shared by the API and the worker."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import APIError
from app.models import ExportJob, Job, User


def _locked_user(session: Session, user_id) -> User | None:
    return session.scalar(select(User).where(User.id == user_id).with_for_update())


def charge_tokens(session: Session, user_id, amount: int) -> User:
    """Lock the account, verify the balance and withdraw `amount` tokens."""
    user = _locked_user(session, user_id)
    if user is None:
        raise APIError(500, "INTERNAL_ERROR", "Пользователь не найден")
    if amount < 0:
        raise APIError(500, "INTERNAL_ERROR", "Некорректная стоимость обработки")
    if user.token_balance < amount:
        raise APIError(
            402,
            "INSUFFICIENT_TOKENS",
            "Недостаточно токенов для обработки",
            {"required": amount, "balance": user.token_balance},
        )
    user.token_balance -= amount
    return user


def refund_tokens(session: Session, user_id, amount: int) -> bool:
    if amount <= 0:
        return False
    user = _locked_user(session, user_id)
    if user is None:
        return False
    user.token_balance += amount
    return True


def refund_job(session: Session, job: Job) -> bool:
    """Refund a job once. Full refunds apply to failures and pre-start cancels."""
    if job.credits_refunded or not job.credits_cost:
        return False
    if not refund_tokens(session, job.user_id, job.credits_cost):
        return False
    job.credits_refunded = True
    return True


def refund_export(session: Session, export: ExportJob) -> bool:
    if export.credits_refunded or not export.credits_cost:
        return False
    if not refund_tokens(session, export.user_id, export.credits_cost):
        return False
    export.credits_refunded = True
    return True
