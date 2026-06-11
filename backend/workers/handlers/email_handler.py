import random
import time


def send_email(payload):

    time.sleep(2)  # simulate external service

    # simulate failure
    if random.random() < 0.3:
        raise Exception("SMTP service failed")

    return {
        "status": "sent",
        "to": payload.get("to"),
    }