from jobs.models import DeadLetterJob


def move_to_dlq(job, error):

    return DeadLetterJob.objects.create(
        original_job=job,
        error=str(error),
    )
