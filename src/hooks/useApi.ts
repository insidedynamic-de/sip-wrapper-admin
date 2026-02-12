import { useState, useCallback } from 'react';
import type { AxiosResponse } from 'axios';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T>() {
  const [state, setState] = useState<ApiState<T>>({ data: null, loading: false, error: null });

  const execute = useCallback(async (request: () => Promise<AxiosResponse<T>>) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await request();
      setState({ data: res.data, loading: false, error: null });
      return res.data;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Request failed';
      setState((s) => ({ ...s, loading: false, error: msg }));
      return null;
    }
  }, []);

  return { ...state, execute };
}
