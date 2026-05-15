import { useCallback, useRef, useState } from "react";

/**
 * In-app route history so Back returns to the previous screen, not always home.
 * Sidebar / primary nav uses `{ reset: true }` to start a fresh stack for that section.
 */
export function useRouteNavigation(initialRoute = "dashboard") {
  const [route, setRoute] = useState(initialRoute);
  const stackRef = useRef([initialRoute]);

  const navigate = useCallback((next, options = {}) => {
    if (!next) return;
    const { replace = false, reset = false } = options;

    setRoute((current) => {
      if (reset) {
        stackRef.current = [next];
        return next;
      }

      if (replace) {
        const stack = stackRef.current;
        const base = stack.length > 1 ? stack.slice(0, -1) : stack.length ? [stack[0]] : [];
        stackRef.current = [...base, next];
        return next;
      }

      if (next === current) return current;

      const stack = stackRef.current;
      if (stack[stack.length - 1] === next) return current;
      stackRef.current = [...stack, next];
      return next;
    });

    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const back = useCallback((fallback = "dashboard") => {
    setRoute(() => {
      const stack = stackRef.current;
      if (stack.length <= 1) {
        const target = fallback || "dashboard";
        stackRef.current = [target];
        return target;
      }
      const newStack = stack.slice(0, -1);
      stackRef.current = newStack;
      return newStack[newStack.length - 1];
    });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const resetStack = useCallback((next = "dashboard") => {
    stackRef.current = [next];
    setRoute(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return {
    route,
    go: navigate,
    back,
    resetStack,
    navigate,
  };
}

/** Trial shell: setup → live → scorecard with its own stack. */
export function useTrialNavigation(initialRoute = "setup") {
  const [route, setRoute] = useState(initialRoute);
  const stackRef = useRef([initialRoute]);

  const go = useCallback((next, options = {}) => {
    if (!next) return;
    const { replace = false } = options;

    setRoute((current) => {
      if (replace && stackRef.current.length) {
        stackRef.current = [...stackRef.current.slice(0, -1), next];
        return next;
      }
      if (next === current) return current;
      if (stackRef.current[stackRef.current.length - 1] === next) return current;
      stackRef.current = [...stackRef.current, next];
      return next;
    });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const back = useCallback((fallback = "setup") => {
    setRoute(() => {
      const stack = stackRef.current;
      if (stack.length <= 1) {
        stackRef.current = [fallback];
        return fallback;
      }
      const newStack = stack.slice(0, -1);
      stackRef.current = newStack;
      return newStack[newStack.length - 1];
    });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const reset = useCallback((next = "setup") => {
    stackRef.current = [next];
    setRoute(next);
  }, []);

  const canBack = useCallback(() => stackRef.current.length > 1, []);

  return { route, setRoute: go, go, back, reset, canBack };
}
