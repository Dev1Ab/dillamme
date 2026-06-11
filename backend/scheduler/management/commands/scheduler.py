import time
import logging
import heapq
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from django.db.models import Q

from jobs.models import Job
from jobs.services.dag_service import dependencies_completed
from scheduler.starvation import effective_priority


logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Background Job Scheduler (Heap-based)"

    SLEEP_INTERVAL = 5  # seconds

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.SUCCESS("Scheduler started..."))

        while True:
            try:
                self.run_scheduler_cycle()

            except Exception as e:
                logger.exception(
                    {
                        "event": "scheduler_error",
                        "error": str(e),
                    }
                )

            time.sleep(self.SLEEP_INTERVAL)

    def run_scheduler_cycle(self):
        now = timezone.now()

        # Fetch eligible jobs
        with transaction.atomic():
            jobs = Job.objects.filter(
                status="pending",
                is_queued=False,
            ).filter(
                # scheduled jobs only when time has passed
                Q(scheduled_at__isnull=True)
                | Q(scheduled_at__lte=now)
            )

            heap = []

            for job in jobs.iterator():
                if not dependencies_completed(job):
                    continue

                priority = effective_priority(job)

                scheduled_time = job.scheduled_at or now

                heapq.heappush(
                    heap,
                    (
                        priority,
                        scheduled_time,
                        job.created_at,
                        job.id,
                    ),
                )

            if not heap:
                return

        while heap:
            priority, scheduled_time, created_at, job_id = heapq.heappop(heap)

            self.enqueue_job(job_id)

    def enqueue_job(self, job_id):
        """
        Marks job as ready for workers
        """
        with transaction.atomic():
            try:
                job = Job.objects.select_for_update().get(id=job_id)

                if job.status != "pending":
                    return

                if job.is_queued:
                    return

                job.is_queued = True

                job.save(update_fields=[
                    "is_queued",
                    "updated_at",
                ])

                logger.info({
                    "event": "job_queued",
                    "job_id": str(job.id),
                    "priority": job.priority,
                    "type": job.type,
                })

                self.stdout.write(
                    f"Queued job {job.id} (priority={job.priority})"
                )

            except Job.DoesNotExist:
                logger.warning({
                    "event": "job_not_found",
                    "job_id": str(job_id),
                })
