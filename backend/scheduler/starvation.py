from django.utils import timezone


AGING_THRESHOLD = 600  # seconds


def effective_priority(job):

    age = (
        timezone.now() - job.created_at
    ).total_seconds()

    boosts = int(age // AGING_THRESHOLD)

    priority = max(
        1,
        job.priority - boosts,
    )

    return priority