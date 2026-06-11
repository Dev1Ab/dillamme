from .email_handler import send_email


HANDLERS = {
    "send_email": send_email,
}


def get_handler(job_type):

    handler = HANDLERS.get(job_type)

    if not handler:
        raise Exception(f"No handler for job type: {job_type}")

    return handler