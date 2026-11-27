from celery import Celery

from app.config import settings

celery_app = Celery(
    "sprite_interpolator",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.worker"],
)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    task_ignore_result=True,
    task_store_errors_even_if_ignored=True,
    broker_connection_retry_on_startup=True,
    worker_prefetch_multiplier=1,
)
