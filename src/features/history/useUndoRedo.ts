import { useState, useCallback } from 'react';
import { Redaction } from '../../domain/redaction';

interface HistoryState {
  past: Redaction[][];
  present: Redaction[];
  future: Redaction[][];
}

export function useUndoRedo(initialState: Redaction[] = []) {
  const [state, setState] = useState<HistoryState>({
    past: [],
    present: initialState,
    future: [],
  });

  const setRedactions = useCallback(
    (newRedactionsOrFn: Redaction[] | ((prev: Redaction[]) => Redaction[])) => {
      setState((prevState) => {
        const nextPresent =
          typeof newRedactionsOrFn === 'function'
            ? newRedactionsOrFn(prevState.present)
            : newRedactionsOrFn;

        return {
          past: [...prevState.past, prevState.present],
          present: nextPresent,
          future: [],
        };
      });
    },
    []
  );

  const reset = useCallback((newState: Redaction[]) => {
    setState({
      past: [],
      present: newState,
      future: [],
    });
  }, []);

  const undo = useCallback(() => {
    setState((prevState) => {
      if (prevState.past.length === 0) return prevState;
      const previous = prevState.past[prevState.past.length - 1];
      const newPast = prevState.past.slice(0, prevState.past.length - 1);

      return {
        past: newPast,
        present: previous,
        future: [prevState.present, ...prevState.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((prevState) => {
      if (prevState.future.length === 0) return prevState;
      const next = prevState.future[0];
      const newFuture = prevState.future.slice(1);

      return {
        past: [...prevState.past, prevState.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  return {
    redactions: state.present,
    setRedactions,
    reset,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
