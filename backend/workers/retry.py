import random
from datetime import timedelta
from django.utils import timezone


BACKOFF = {
    1: 1,
    2: 5,
    3: 25,
}


def get_retry_delay(attempt):
    return BACKOFF.get(attempt, 25)


def next_retry_time(attempt):
    delay = get_retry_delay(attempt)
    jitter = random.uniform(0, 2)

    return timezone.now() + timedelta(seconds=delay + jitter)