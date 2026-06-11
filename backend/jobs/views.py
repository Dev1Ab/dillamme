from datetime import timedelta
import json
import asyncio
from django.utils import timezone
from django.http import StreamingHttpResponse
from django.db import transaction, close_old_connections

from rest_framework import viewsets
from rest_framework.views import APIView

from rest_framework import status
from rest_framework.decorators import action

from config.responses import success_response, error_response
from .models import DeadLetterJob, Job
from .serializers import DeadLetterJobSerializer, JobSerializer

# Create your views here.

class JobViewSet(viewsets.ModelViewSet):

    queryset = Job.objects.all()

    serializer_class = JobSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        job = serializer.save()

        return success_response(
            data=JobSerializer(job).data,
            message="Job created successfully.",
            status_code=status.HTTP_201_CREATED,
        )
    
    def retrieve(self, request, *args, **kwargs):
        job = self.get_object()

        return success_response(
            data=JobSerializer(job).data,
            message="Job retrieved successfully.",
        )
    
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        serializer = self.get_serializer(queryset, many=True)

        return success_response(
            data=serializer.data,
            message="Jobs retrieved successfully.",
        )
    
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)

        instance = self.get_object()

        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=partial,
        )

        serializer.is_valid(raise_exception=True)

        job = serializer.save()

        return success_response(
            data=JobSerializer(job).data,
            message="Job updated successfully.",
        )


class DeadLetterJobViewSet(viewsets.ReadOnlyModelViewSet):

    queryset = DeadLetterJob.objects.select_related(
        "original_job"
    ).order_by("-failed_at")

    serializer_class = DeadLetterJobSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        serializer = self.get_serializer(queryset, many=True)

        return success_response(
            data=serializer.data,
            message="Dead-letter jobs retrieved successfully.",
        )

    def retrieve(self, request, *args, **kwargs):
        dead_letter_job = self.get_object()

        return success_response(
            data=DeadLetterJobSerializer(dead_letter_job).data,
            message="Dead-letter job retrieved successfully.",
        )
    
    @action(detail=True, methods=["post"], url_path="retry")
    def retry(self, request, pk=None):

        with transaction.atomic():
            data = request.data

            dlq = self.get_object()

            job = dlq.original_job
            dead_letter_job_id = str(dlq.id)
            
            job.type = data.get("type", job.type)
            job.priority = data.get("priority", job.priority)
            job.payload = data.get("payload", job.payload)

            job.status = "pending"

            job.is_queued = False

            job.scheduled_at = None

            job.last_error = None

            job.save(update_fields=[
                "type",
                "priority",
                "payload",
                "status",
                "is_queued",
                "scheduled_at",
                "last_error",
                "updated_at",
            ])
            dlq.delete()


        return success_response(
            message="Job moved back to queue.",
            data={
                "dead_letter_job_id": dead_letter_job_id,
                "job": JobSerializer(job).data,
            },
            status_code=status.HTTP_200_OK,
        )
    

async def job_stream_view(request):
    async def event_stream():
        yield ": initial connection established\n\n"
        last_checked = timezone.now()
        
        while True:
            close_old_connections()
            check_time = timezone.now()
            buffer_time = last_checked - timedelta(seconds=2)

            recent_jobs = Job.objects.filter(updated_at__gte=buffer_time)

            async for job in recent_jobs:
                data = {
                    "id": job.id,
                    "status": job.status,
                    "retry_count": job.retry_count,
                    "type": job.type,
                    "priority": job.priority,
                    "is_queued": job.is_queued,
                    "scheduled_at": job.scheduled_at,
                    "created_at": job.created_at,
                    "updated_at": job.updated_at,

                }
                yield f"data: {json.dumps(data, default=str)}\n\n"
                await asyncio.sleep(0.01)
            
            last_checked = check_time
            
            await asyncio.sleep(1.5)

    response = StreamingHttpResponse(
        event_stream(), 
        content_type='text/event-stream'
    )
    
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no' 
    return response