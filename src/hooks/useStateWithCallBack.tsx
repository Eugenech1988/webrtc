import { useCallback, useEffect, useRef, useState } from 'react';

type Callback<T> = (value: T) => void;

export default function useStateWithCallback<T>(
  initialState: T
): [T, (newState: T | ((prev: T) => T), cb?: Callback<T>) => void] {
  const [state, setState] = useState<T>(initialState);
  const callbackRef = useRef<Callback<T> | null>(null);

  const setStateWithCallback = useCallback((newState: T | ((prev: T) => T), cb?: Callback<T>) => {
    if (cb) {
      callbackRef.current = cb;
    }

    setState((prevState) => {
      const resolvedState =
        typeof newState === 'function' ? (newState as (prev: T) => T)(prevState) : newState;
      return resolvedState;
    });
  }, []);

  useEffect(() => {
    if (callbackRef.current) {
      callbackRef.current(state);
      callbackRef.current = null;
    }
  }, [state]);

  return [state, setStateWithCallback];
}
