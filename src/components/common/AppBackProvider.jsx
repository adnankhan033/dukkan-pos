import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";

const AppBackContext = createContext({
  canGoBack: false,
  showBack: false,
  goBack: () => {},
});

const AUTH_PATHS = new Set(["/login", "/setup", "/activate"]);

function pathKey(location) {
  return location?.pathname || "/";
}

function isAuthPath(pathname) {
  return AUTH_PATHS.has(pathname);
}

export function AppBackProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const navType = useNavigationType();
  const stackRef = useRef([]);
  const goingBackRef = useRef(false);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    const key = pathKey(location);
    if (isAuthPath(key)) return;

    const stack = stackRef.current;

    if (goingBackRef.current) {
      goingBackRef.current = false;
      if (stack[stack.length - 1] !== key) stack.push(key);
      setCanGoBack(stack.length > 1);
      return;
    }

    if (navType === "REPLACE") {
      if (stack.length === 0) stack.push(key);
      else stack[stack.length - 1] = key;
    } else if (navType === "POP") {
      const idx = stack.lastIndexOf(key);
      if (idx >= 0) stack.splice(idx + 1);
      else if (stack[stack.length - 1] !== key) stack.push(key);
    } else if (stack[stack.length - 1] !== key) {
      stack.push(key);
    }

    if (stack.length > 40) stack.splice(0, stack.length - 40);
    setCanGoBack(stack.length > 1);
  }, [location, navType]);

  const goBack = useCallback(() => {
    const stack = stackRef.current;
    if (stack.length > 1) {
      stack.pop();
      let prev = stack[stack.length - 1];
      while (prev && isAuthPath(prev)) {
        stack.pop();
        prev = stack[stack.length - 1];
      }
      goingBackRef.current = true;
      navigate(prev || "/");
      return;
    }
    if (location.pathname !== "/") navigate("/");
  }, [location.pathname, navigate]);

  const value = useMemo(
    () => ({
      canGoBack,
      showBack: canGoBack,
      goBack,
    }),
    [canGoBack, goBack]
  );

  return <AppBackContext.Provider value={value}>{children}</AppBackContext.Provider>;
}

export function useAppBack() {
  return useContext(AppBackContext);
}
