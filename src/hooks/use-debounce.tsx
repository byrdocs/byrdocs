import { useState, useEffect, useRef } from 'react';

export function useDebounce<T>(value: T, delay: number): [T, boolean] {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const [debouncing, setDebouncing] = useState<boolean>(false);

  useEffect(() => {
    setDebouncing(true);
    if (!value && debouncedValue) {
        setDebouncedValue(value);
        setDebouncing(false);
        return;
    }
    const handler = setTimeout(() => {
      setDebouncedValue(value);
      setDebouncing(false);
    }, delay);

    return () => {
      clearTimeout(handler);
      setDebouncing(false);
    };
  }, [value, delay]);

  return [debouncedValue, debouncing];
}

export function useDebounceFn(callback: Function, delay: number) {
  const timer = useRef<NodeJS.Timeout | null>(null);

  const debouncedFn = (...args: any[]) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }

    timer.current = setTimeout(() => {
      callback(...args);
    }, delay);
  };

  return debouncedFn;
}

