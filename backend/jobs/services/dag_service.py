from jobs.models import Job


def dependencies_completed(job: Job) -> bool:

    return not job.parents.exclude(
        parent__status="completed"
    ).exists()