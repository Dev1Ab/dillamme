import heapq


class IndexedPriorityQueue:

    def __init__(self):

        self.heap = []

        self.entry_finder = {}

    def push(self, job_id, priority):

        entry = (priority, job_id)

        self.entry_finder[job_id] = entry

        heapq.heappush(self.heap, entry)

    def pop(self):

        while self.heap:

            priority, job_id = heapq.heappop(
                self.heap
            )

            if job_id in self.entry_finder:

                del self.entry_finder[job_id]

                return priority, job_id

        return None

    def update(self, job_id, priority):

        self.remove(job_id)

        self.push(job_id, priority)

    def remove(self, job_id):

        self.entry_finder.pop(job_id, None)