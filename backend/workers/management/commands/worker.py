from django.core.management.base import BaseCommand
from workers.worker import Worker


class Command(BaseCommand):

    help = "Run background worker"

    def add_arguments(self, parser):
        parser.add_argument(
            "--name",
            type=str,
            default="worker-1",
        )

    def handle(self, *args, **options):

        name = options["name"]

        self.stdout.write(
            self.style.SUCCESS(
                f"{name} started..."
            )
        )

        worker = Worker()
        worker.run()