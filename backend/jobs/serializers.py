from rest_framework import serializers

from .models import DeadLetterJob, Job, JobDependency


class JobSerializer(serializers.ModelSerializer):

    dependencies = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
    )

    dependency_ids = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = "__all__"

        read_only_fields = (
            "id",
            "status",
            "retry_count",
            "last_error",
            "created_at",
            "started_at",
            "completed_at",
            "updated_at",
            "dependency_ids",
        )

    def validate_dependencies(self, value):

        for job_id in value:

            if not Job.objects.filter(id=job_id).exists():
                raise serializers.ValidationError(
                    f"Job {job_id} does not exist."
                )

        return value

    def create(self, validated_data):

        dependencies = validated_data.pop(
            "dependencies",
            []
        )

        job = Job.objects.create(**validated_data)

        for dependency_id in dependencies:
            if dependency_id == job.id:

                raise serializers.ValidationError(
                    "A job cannot depend on itself."
                )

            parent = Job.objects.get(id=dependency_id)

            JobDependency.objects.create(
                parent=parent,
                child=job,
            )

        return job
    
    def get_dependency_ids(self, obj):

        return list(
            obj.parents.values_list(
                "parent_id",
                flat=True,
            )
        )


class DeadLetterJobSerializer(serializers.ModelSerializer):

    original_job = JobSerializer(read_only=True)

    class Meta:
        model = DeadLetterJob
        fields = (
            "id",
            "original_job",
            "error",
            "failed_at",
        )
        # read_only_fields = fields
