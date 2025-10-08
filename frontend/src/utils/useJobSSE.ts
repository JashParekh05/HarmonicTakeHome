// useJobSSE.ts
import { useEffect, useState } from 'react';

export interface JobProgress {
  done: number;
  total: number;
  state: string;
  progress: number;
  error?: string;
}

export function useJobSSE(jobId: string | null, onProgress: (progress: JobProgress) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const eventSource = new EventSource(`http://localhost:8000/jobs/${jobId}/stream`);
    
    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'keepalive') return;
        
        onProgress({
          done: data.done || 0,
          total: data.total || 0,
          state: data.state || 'unknown',
          progress: data.progress || 0,
          error: data.error
        });
      } catch (e) {
        console.error('Error parsing SSE message:', e);
      }
    };

    eventSource.onerror = (event) => {
      console.error('SSE error:', event);
      setError('Connection lost');
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [jobId, onProgress]);

  return { isConnected, error };
}
