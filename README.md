# Dilamme Job Queue: Background Job Scheduler

## Project Overview
Dilamme is a full-stack, real-time distributed background job processing system. It allows users to schedule, monitor, cancel, and automatically retry asynchronous tasks. The system features a real-time React dashboard that updates job statuses instantly without page reloads, backed by a robust Django and PostgreSQL infrastructure.

## Technology Stack
* **Backend:** Django, Django REST Framework
* **Database:** PostgreSQL
* **Asynchronous Server:** Daphne (ASGI)
* **Frontend:** React, Vite, Tailwind CSS
* **Deployment:** IBM LinuxONE (s390x mainframe architecture), Ubuntu, Nginx

---

## Key Components Implemented

### Custom Worker & Scheduler
Instead of relying on heavy third-party task queues like Celery and message brokers like Redis/RabbitMQ, the system implements its own background worker and scheduler using Django Management Commands (`worker`, `scheduler`).
* **The Scheduler** handles finding eligible jobs, applying starvation prevention, ordering jobs using a heap, marking jobs ready for processing into the active queue, and handles recurring jobs and moves delayed jobs into the active queue when their `scheduled_at` time arrives.
* **The Worker** continuously polls the database for pending jobs, executes them, handles failures (including retries and Dead Letter Queue routing), and updates job statuses.

### Heap-Based Priority Queue

The primary scheduling algorithm uses a heap.

Jobs are ordered by:

- Effective priority
- Scheduled execution time
- Creation time

Implementation:
```

(
    priority,
    scheduled_time,
    created_time,
    job_id,
)
```
Python's heap implementation naturally respects this ordering.

### Real-Time Updates via Server-Sent Events (SSE)
The system pushes status updates (e.g., pending -> processing -> completed) to the React frontend the millisecond a worker updates the database.
* Implemented an async generator in Django (`job_stream_view`) that yields JSON data.
* Connected the React frontend using a custom `useSSE` hook to listen to the stream and selectively update the UI state.

### Mainframe Deployment (IBM LinuxONE)
Successfully deployed the application to an IBM s390x mainframe architecture.
* Configured C-compilers (`build-essential`, `python3-dev`, `libpq-dev`) to compile Python dependencies from source, as pre-compiled x86 wheels do not work on s390x.
* Set up three permanent Linux systemd services (`dillamme-web`, `dillamme-worker`, `dillamme-worker2`, `dillamme-scheduler`) to ensure 100% uptime.
* Configured Nginx as a reverse proxy, specifically disabling `proxy_buffering` on the `/api/events/jobs/` route to allow the SSE stream to pass through continuously.

---

## Architectural Decisions

### `SELECT ... FOR UPDATE SKIP LOCKED` (Duplicate Protection)
**Decision:** Used database-level locking for worker synchronization.
**Why:** In a distributed system, to prevent two workers from trying to grab the exact same job at the same millisecond. By using Postgres's `SKIP LOCKED`, the lock is on the database layer. If Worker A grabs Job 1, Postgres instantly hides Job 1 from Worker B, forcing Worker B to grab Job 2. This mathematically eliminates race conditions and allows us to scale to infinite workers.

### Server-Sent Events (SSE)
**Decision:** Used SSE over HTTP/1.1 instead of WebSockets.
**Why:** The data flow for the dashboard is strictly one-way: Server -> Client. The client never needs to stream real-time data back to the server (it uses standard REST API POST requests for that). SSE is much lighter, natively supported by browsers, automatically reconnects if the connection drops, and is vastly easier to configure through Nginx firewalls than WebSockets.

### Dead-Letter Queue (DLQ)

When a job exhausts its 3 allocated retries (utilizing a jittered exponential backoff strategy of ~1s, ~5s, and ~25s), it is flagged as `failed` and transferred to the Dead-Letter Queue (DLQ). 

**DLQ Alert Threshold: 50 Jobs**
We have defined the DLQ critical alert threshold at **50 jobs**. 

**Alerting Logic:**
To prevent "alert fatigue" and email spam storms during a systemic outage, the alerting mechanism evaluates the total DLQ count using a modulo operator (`dlq_count % 50 == 0`). 
- An automated email is dispatched to the on-call engineering team exactly when the queue crosses 50 jobs. 
- If the issue is not resolved and jobs continue to fail, subsequent alerts will only fire at logical escalation intervals (100, 150, 200), ensuring engineers are updated on the severity without their inboxes being paralyzed.



### Job Cancellation & Concurrency Handling

When a job is cancelled, its database status is immediately set to `cancelled`. However, if the job is *already processing* by a worker when the cancellation occurs, we made the explicit decision **not to hard-kill the worker thread (e.g., via SIGKILL).** **Because**
Force-killing a running worker is an anti-pattern. It leaves database transactions open, orphans locks, corrupts files being written, and leaks memory. 

**How it is handled:**
1. **Pending/Queued:** If the job hasn't started, the worker simply ignores it.
2. **Processing:** We allow the executing handler to gracefully complete its current instruction set to maintain system integrity. However, right before the worker commits the "completed" state, it calls `refresh_from_db()` to check for an in-flight cancellation flag. 
3. **Interception:** If the worker detects the job was cancelled during processing, it discards the result, aborts the completion phase, and halts immediately. It explicitly **prevents** any recurring interval rescheduling, retry logic, or dependent DAG jobs from firing.

### Starvation Prevention
To ensure low-priority (Level 3) jobs are not indefinitely blocked by a constant influx of high-priority (Level 1) jobs, the scheduler applies a dynamic priority boost based on the job's age. 

**The Logic:**
The starvation threshold is set to **600 seconds (10 minutes)**. During the heap sort evaluation, the system calculates the job's age (`timezone.now() - job.created_at`). For every full 10-minute block that has passed, the job's effective priority is boosted by 1 level (subtracting 1 from its priority integer).

**Example:**
A Priority 3 job sits in the queue. 
* At 0-9 minutes: Evaluates as Priority 3.
* At 10 minutes: Evaluates as Priority 2.
* At 20 minutes: Evaluates as Priority 1 (Maximum boost).

This guarantees that all jobs, regardless of their initial priority, will eventually bubble to the absolute top of the queue if they wait long enough.

### Job Execution Handler
**Implemented Handler: Email Delivery Simulation**
The worker processes jobs using a simulated external email provider (`send_email`). To prove the robustness of the worker's error handling, retry logic, and queue isolation, the handler incorporates two realistic behaviors:
1. **Simulated Latency:** It utilizes a synchronous 2-second blocking delay (`time.sleep(2)`) to mimic network I/O to an external SMTP server.
2. **Simulated Unreliability:** It introduces an artificial 30% failure rate (`random.random() < 0.3`). When triggered, it raises an explicit `Exception("SMTP service failed")`. This guarantees the worker will catch the exception, increment the `retry_count`, apply the jittered exponential backoff, and eventually route persistently failing jobs to the Dead-Letter Queue (DLQ). Successful executions return a confirmed payload.

### Structured Logging
Python's logging module used for outputting strictly formatted JSON strings. The system logs the following lifecycle events: job_created, job_started, retry_attempted, job_failed, job_cancelled, and job_completed.

Each log entry includes the timestamp, job_id, status, worker_id, and execution_time_ms, ensuring it is immediately parsable by standard log aggregation tools like Datadog or ELK.

### DAG Workflow (Job Dependencies)
The system supports Directed Acyclic Graphs (DAGs) for job execution. A job can be created with an array of dependency_ids.

- Logic: When a dependent job is saved to the database, its is_queued flag remains False. The scheduler skips this job.

- Resolution: When a worker successfully completes a job, it triggers a check for any downstream jobs that depend on it. If all dependencies for a downstream job are now completed, the worker flags the downstream job as is_queued = True, allowing the scheduler to pick it up in the next tick. If a parent job fails, the downstream job is automatically cancelled to prevent cascade failures.


## Alternative Scheduling & Benchmarks

### Alternative Scheduling Algorithm: Indexed Priority Queue (IPQ)

Alongside the standard Heap, an Indexed Priority Queue was implemented as an alternative scheduling algorithm.Why IPQ: While a standard binary heap offers $O(\log n)$ extraction and insertion, updating a specific job's priority inside the heap (like during starvation prevention) requires an $O(n)$ search. An IPQ maintains a hash map of job IDs to their heap indices, bringing the time complexity of priority updates down to $O(\log n)$.

### Benchmarks (Processing 50,000 pending jobs):
Generating 50000 synthetic jobs for benchmark...
Running Standard Heap...
Running Indexed Priority Queue...

**SCHEDULER ALGORITHM BENCHMARK REPORT**

Total Jobs Processed : 50,000
Standard Heap Time   : 0.1233 seconds
Indexed P.Q. Time    : 0.2135 seconds

 Winner: Standard Heap
Why? Because we aren't doing mid-queue updates (like cancelling a queued job). The overhead of maintaining the dictionary in the Indexed PQ makes it slightly slower for pure insert/pop operations.
