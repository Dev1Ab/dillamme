# apps/jobs/services/recurrence.py

from datetime import timedelta
from django.utils import timezone

from jobs.models import Job, JobDependency


INTERVAL_MAP = {
    "1m": timedelta(minutes=1),
    "5m": timedelta(minutes=5),
    "1h": timedelta(hours=1),
}


def schedule_next_run(job):

    if not job.recurring_interval:
        return

    next_time = timezone.now() + INTERVAL_MAP[
        job.recurring_interval
    ]

    new_job = Job.objects.create(
        type=job.type,
        payload=job.payload,
        priority=job.priority,
        scheduled_at=next_time,
        recurring_interval=job.recurring_interval,
    )

    return new_job