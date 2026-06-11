import { useState, useEffect, useRef, useCallback } from 'react';

const useSSE = (url, onMessage, customEventTypes = []) => {
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('connecting');
  const eventSourceRef = useRef(null);

  
  const savedOnMessage = useRef(onMessage);

  const closeConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setStatus('closed');
    }
  }, []);

  useEffect(() => {
    savedOnMessage.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!url) return;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setStatus('connected');
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);
        if (savedOnMessage.current) {
          savedOnMessage.current(parsedData);
        }
      } catch (err) {
        setStatus('error');
        setError("Failed to parse SSE data: " + err.message);
        
      }
    };

    eventSource.onerror = (err) => {
      setStatus('reconnecting');
      setError("Connection lost. Attempting to reconnect...");
      console.error("SSE Connection Error:", err);
      // eventSource.close();
    };

    const handleCustomEvent = (eventName) => (event) => {
      savedOnMessage.current?.({ type: eventName, payload: event.data });
      
      if (eventName === 'closeStream') {
        setStatus('closed');
        eventSource.close();
      }
    };

    customEventTypes.forEach((eventName) => {
      eventSource.addEventListener(eventName, handleCustomEvent(eventName));
    });



    return () => {
      eventSource.close();
      
      customEventTypes.forEach((eventName) => {
        eventSource.removeEventListener(eventName, handleCustomEvent(eventName));
      });
      setStatus('closed');
    };
  }, [url]); 

  return { status, error, closeConnection };
};

export default useSSE;