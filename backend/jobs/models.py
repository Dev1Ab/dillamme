import uuid

from django.db import models


class Job(models.Model):

    PRIORITY_CHOICES = (
        (1, "High"),
        (2, "Medium"),
        (3, "Low"),
    )

    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("cancelled", "Cancelled"),
    )

    INTERVAL_CHOICES = (
        ("1m", "Every Minute"),
        ("5m", "Every 5 Minutes"),
        ("1h", "Every Hour"),
    )

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    type = models.CharField(max_length=100)

    payload = models.JSONField()

    priority = models.IntegerField(
        choices=PRIORITY_CHOICES,
        default=2,
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
    )

    is_queued = models.BooleanField(default=False)

    scheduled_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    recurring_interval = models.CharField(
        max_length=10,
        choices=INTERVAL_CHOICES,
        null=True,
        blank=True,
    )

    retry_count = models.PositiveIntegerField(default=0)

    last_error = models.TextField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    started_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    completed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["status", "is_queued"]),
        ]

    def __str__(self):
        return f"{self.id} ({self.status})"


class JobDependency(models.Model):
    # id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    parent = models.ForeignKey(
        Job,
        on_delete=models.CASCADE,
        related_name="children",
    )

    child = models.ForeignKey(
        Job,
        on_delete=models.CASCADE,
        related_name="parents",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("parent", "child")

    def __str__(self):
        return f"{self.parent_id} -> {self.child_id}"
    
class DeadLetterJob(models.Model):

    # id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    original_job = models.OneToOneField(Job, on_delete=models.CASCADE)

    error = models.TextField()

    failed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"DLQ: {self.original_job_id}"

class JobLog(models.Model):
    class EventType(models.TextChoices):
        JOB_CREATED = "JOB_CREATED", "Job Created"
        JOB_STARTED = "JOB_STARTED", "Job Started"
        JOB_RETRY = "JOB_RETRY", "Job Retry"
        JOB_FAILED = "JOB_FAILED", "Job Failed"
        JOB_CANCELLED = "JOB_CANCELLED", "Job Cancelled"
        JOB_COMPLETED = "JOB_COMPLETED", "Job Completed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    job = models.ForeignKey(
        Job,
        on_delete=models.CASCADE,
        related_name="logs"
    )

    event_type = models.CharField(
        max_length=30,
        choices=EventType.choices
    )

    metadata = models.JSONField(
        default=dict,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.event_type} - {self.job_id}"