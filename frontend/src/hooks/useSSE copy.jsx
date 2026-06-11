import { useState, useEffect, useRef, useCallback } from 'react';

const useSSE = (url, customEventTypes = []) => {
  const [data, setData] = useState([]);
  const [status, setStatus] = useState('connecting'); // 'connecting', 'connected', 'error', 'closed'
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);

  // Allow manual closing of the connection from the component
  const closeConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setStatus('closed');
    }
  }, []);

  useEffect(() => {
    if (!url) return;

    // 1. Initialize EventSource
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    // 2. Handle Connection Open
    eventSource.onopen = () => {
      setStatus('connected');
      setError(null);
    };

    // 3. Handle Standard Messages
    eventSource.onmessage = (event) => {
      setData((prev) => [...prev, { type: 'message', payload: event.data }]);
    };

    // 4. Handle Errors
    eventSource.onerror = (err) => {
      console.error("SSE Error:", err);
      setStatus('error');
      setError(err);
      
      // Note: By default, the browser will attempt to reconnect.
      // If you want a fatal error to permanently close the stream, uncomment the next line:
      // eventSource.close();
    };

    // 5. Handle Custom Events
    const handleCustomEvent = (eventName) => (event) => {
      setData((prev) => [...prev, { type: eventName, payload: event.data }]);
      
      // If the server sends our specific close event, shut it down natively
      if (eventName === 'closeStream') {
        setStatus('closed');
        eventSource.close();
      }
    };

    // Attach listeners for all provided custom event types
    customEventTypes.forEach((eventName) => {
      eventSource.addEventListener(eventName, handleCustomEvent(eventName));
    });

    // 6. Cleanup on Unmount
    return () => {
      eventSource.close();
      customEventTypes.forEach((eventName) => {
        eventSource.removeEventListener(eventName, handleCustomEvent(eventName));
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]); // Only re-run if the URL changes

  return { data, status, error, closeConnection };
};

export default useSSE;