import time
import heapq
import random
from django.core.management.base import BaseCommand

class IndexedPriorityQueue:
    """
    Alternative Algorithm: Indexed Priority Queue
    Uses a dictionary to keep track of tasks, allowing fast updates and deletions.
    """
    def __init__(self):
        self.pq = []                         # list of entries arranged in a heap
        self.entry_finder = {}               # mapping of tasks to entries
        self.REMOVED = '<removed-task>'      # placeholder for a removed task
        self.counter = 0                     # unique sequence count

    def add_job(self, job_id, priority):
        if job_id in self.entry_finder:
            self.remove_job(job_id)
        count = self.counter
        entry = [priority, count, job_id]
        self.entry_finder[job_id] = entry
        heapq.heappush(self.pq, entry)
        self.counter += 1

    def remove_job(self, job_id):
        entry = self.entry_finder.pop(job_id)
        entry[-1] = self.REMOVED

    def pop_job(self):
        while self.pq:
            priority, count, job_id = heapq.heappop(self.pq)
            if job_id is not self.REMOVED:
                del self.entry_finder[job_id]
                return job_id
        return KeyError('pop from an empty priority queue')


class Command(BaseCommand):
    help = "Benchmarks Heap vs Indexed Priority Queue"

    def handle(self, *args, **kwargs):
        NUM_JOBS = 50_000
        self.stdout.write(f"Generating {NUM_JOBS} synthetic jobs for benchmark...\n")
        
        jobs = [(f"job_{i}", random.randint(1, 3)) for i in range(NUM_JOBS)]

        # --- Benchmark 1: Standard Heap (What you currently use) ---
        self.stdout.write("Running Standard Heap...")
        heap = []
        start_time = time.perf_counter()
        
        # Insert
        for job_id, priority in jobs:
            heapq.heappush(heap, (priority, job_id))
        
        # Extract
        while heap:
            heapq.heappop(heap)
            
        heap_time = time.perf_counter() - start_time


        # --- Benchmark 2: Indexed Priority Queue ---
        self.stdout.write("Running Indexed Priority Queue...")
        ipq = IndexedPriorityQueue()
        start_time = time.perf_counter()
        
        # Insert
        for job_id, priority in jobs:
            ipq.add_job(job_id, priority)
            
        # Extract
        try:
            for _ in range(NUM_JOBS):
                ipq.pop_job()
        except KeyError:
            pass
            
        ipq_time = time.perf_counter() - start_time


        # --- Report ---
        self.stdout.write("\n" + "="*40)
        self.stdout.write("SCHEDULER ALGORITHM BENCHMARK REPORT")
        self.stdout.write("="*40)
        self.stdout.write(f"Total Jobs Processed : {NUM_JOBS:,}")
        self.stdout.write(f"Standard Heap Time   : {heap_time:.4f} seconds")
        self.stdout.write(f"Indexed P.Q. Time    : {ipq_time:.4f} seconds")
        
        if heap_time < ipq_time:
            self.stdout.write("\n Winner: Standard Heap")
            self.stdout.write("Why? Because we aren't doing mid-queue updates (like cancelling a queued job). " 
                              "The overhead of maintaining the dictionary in the Indexed PQ makes it slightly slower for pure insert/pop operations.")
        else:
            self.stdout.write("\n Winner: Indexed Priority Queue")
        self.stdout.write("="*40 + "\n")