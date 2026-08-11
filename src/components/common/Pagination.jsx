import Button from "./Button";
import "./Pagination.css";

function buildPageNumbers(page, totalPages, siblingCount = 1) {
  if (totalPages <= 1) return [1];

  const pages = [];
  const left = Math.max(2, page - siblingCount);
  const right = Math.min(totalPages - 1, page + siblingCount);

  pages.push(1);

  if (left > 2) pages.push("ellipsis-left");

  for (let i = left; i <= right; i += 1) {
    pages.push(i);
  }

  if (right < totalPages - 1) pages.push("ellipsis-right");

  if (totalPages > 1) pages.push(totalPages);

  return pages;
}

export default function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
  itemLabel = "items",
}) {
  if (totalPages <= 1 && total <= 0) return null;

  const pageNumbers = buildPageNumbers(page, totalPages);

  return (
    <div className="pagination">
      <span className="pagination-info">
        Page {page} of {totalPages} ({total.toLocaleString()} {itemLabel})
      </span>

      <div className="pagination-controls">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>

        <div className="pagination-pages" role="navigation" aria-label="Pagination">
          {pageNumbers.map((entry) => {
            if (typeof entry === "string") {
              return (
                <span key={entry} className="pagination-ellipsis" aria-hidden="true">
                  …
                </span>
              );
            }

            return (
              <button
                key={entry}
                type="button"
                className={`pagination-page ${entry === page ? "active" : ""}`}
                onClick={() => onPageChange(entry)}
                aria-current={entry === page ? "page" : undefined}
                aria-label={`Page ${entry}`}
              >
                {entry}
              </button>
            );
          })}
        </div>

        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
