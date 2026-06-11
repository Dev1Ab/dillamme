import heapq


class HeapScheduler:

    def __init__(self):

        self.heap = []

    def push(self, priority, scheduled_at, created_at, job_id ):

        heapq.heappush(
            self.heap,
            (
                priority,
                scheduled_at,
                created_at,
                job_id,
            ),
        )

    def pop(self):

        if not self.heap:
            return None

        return heapq.heappop(
            self.heap
        )

    def __len__(self):

        return len(self.heap)