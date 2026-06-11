import time
import logging

from django.db import transaction
from django.utils import timezone

from jobs.models import Job
from .handlers.registry import get_handler
from .retry import next_retry_time
from .dlq import move_to_dlq


logger = logging.getLogger(__name__)


class Worker:

    SLEEP = 2

    def run(self):

        while True:

            job = self.fetch_job()

            if not job:
                time.sleep(self.SLEEP)
                continue

            self.process(job)

    def fetch_job(self):

        with transaction.atomic():

            job = (
                Job.objects.select_for_update(skip_locked=True)
                .filter(
                    status="pending",
                    is_queued=True,
                )
                .order_by("priority", "created_at")
                .first()
            )

            if not job:
                return None

            job.status = "processing"
            job.started_at = timezone.now()
            job.save(update_fields=["status", "started_at", "updated_at"])

            return job

    def process(self, job):

        try:
            handler = get_handler(job.type)

            logger.info({
                "event": "job_started",
                "job_id": str(job.id),
            })

            result = handler(job.payload)

            job.status = "completed"
            job.completed_at = timezone.now()

            job.save(update_fields=["status", "completed_at", "updated_at"])
 

            logger.info({
                "event": "job_completed",
                "job_id": str(job.id),
            })

        except Exception as e:

            self.handle_failure(job, e)

    def handle_failure(self, job, error):

        job.retry_count += 1
        job.last_error = str(error)

        logger.error({
            "event": "job_failed",
            "job_id": str(job.id),
            "error": str(error),
            "retry": job.retry_count,
        })

        if job.retry_count >= 3:

            job.status = "failed"
            job.save(update_fields=["status", "retry_count", "last_error", "updated_at"])
        

            move_to_dlq(job, error)
        
            return

        job.status = "pending"
        job.scheduled_at = next_retry_time(job.retry_count)

        job.save(update_fields=[
            "status",
            "retry_count",
            "last_error",
            "scheduled_at",
            "updated_at",
        ])