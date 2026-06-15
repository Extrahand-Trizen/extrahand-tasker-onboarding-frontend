'use client';

import { useState, useEffect, useCallback } from 'react';

export function useSessionStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      if (typeof window !== 'undefined') {
        const item = sessionStorage.getItem(key);
        return item !== null ? JSON.parse(item) : initialValue;
      }
    } catch (error) {
      console.warn('Error reading sessionStorage key:', key, error);
    }
    return initialValue;
  });

  const setSessionState = useCallback((value: T | ((val: T) => T)) => {
    try {
      setState((prevState) => {
        const newValue = value instanceof Function ? value(prevState) : value;
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(key, JSON.stringify(newValue));
        }
        return newValue;
      });
    } catch (error) {
      console.warn('Error setting sessionStorage key:', key, error);
    }
  }, [key]);

  return [state, setSessionState];
}
