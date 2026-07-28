import { useEffect, useState } from "react";

export function usePagination(total, initialPage = 1, itemsPerPage = 10) {
  const [page, setPage] = useState(initialPage);
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return {
    page,
    setPage,
    totalPages,
    itemsPerPage,
    offset: (page - 1) * itemsPerPage,
  };
}

export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
