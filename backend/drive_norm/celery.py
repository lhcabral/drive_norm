import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "drive_norm.settings")

app = Celery("drive_norm")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
