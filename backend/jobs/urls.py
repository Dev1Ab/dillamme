from django.urls import path, include

from rest_framework.routers import DefaultRouter
from .views import DeadLetterJobViewSet, JobViewSet, job_stream_view

router = DefaultRouter()

router.register("jobs", JobViewSet)
router.register("dlq", DeadLetterJobViewSet)

urlpatterns = [
    path("", include(router.urls)),
    path('events/jobs/', job_stream_view, name='sse-jobs'),
]
