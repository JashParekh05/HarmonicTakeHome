# backend/celery_app.py
import os
from celery import Celery

broker = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
backend = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")

celery = Celery("harmonic", broker=broker, backend=backend)
celery.conf.update(
    task_track_started=True,
    worker_send_task_events=True,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_reject_on_worker_lost=True,
)
