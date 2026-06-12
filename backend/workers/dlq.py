from jobs.models import DeadLetterJob
from notifications.email_service import send_dlq_alert

DLQ_THRESHOLD = 10

def move_to_dlq(job, error):

    DeadLetterJob.objects.create(
        original_job=job,
        error=str(error),
    )

    dlq_count = DeadLetterJob.objects.count()

    if dlq_count > 0 and dlq_count % DLQ_THRESHOLD == 0:
        send_dlq_alert(dlq_count)
    
