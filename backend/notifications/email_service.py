import logging
from django.core.mail import send_mail
from django.utils import timezone

logger = logging.getLogger(__name__)



def send_dlq_alert(count):
    """
    Sends an email alert
    """
    logger.critical({
        "event": "dlq_threshold_exceeded",
        "dlq_count": count,
        "message": f"DLQ has reached {count} jobs. Engineering intervention required."
    })
