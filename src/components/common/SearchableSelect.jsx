import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, Search, X } from "lucide-react";
import "./SearchableSelect.css";

function buildMenuItems({ filtered, clearable, showNone, showCreate, createLabel, query, noneLabel }) {
  const items = [];
  if (clearable && showNone) {
    items.push({ type: "none", value: "", label: noneLabel });
  }
  if (showCreate) {
    items.push({ type: "create", value: "__create__", label: createLabel(query.trim()) });
  }
  for (const option of filtered) {
    items.push({ type: "option", ...option });
  }
  return items;
}

export default function SearchableSelect({
  label,
  value = "",
  onChange,
  options = [],
  placeholder = "Type to search…",
  noneLabel = "None",
  clearable = true,
  error,
  disabled = false,
  className = "",
  creatable = false,
  onCreateOption,
  createLabel = (term) => `Create "${term}"`,
  menuPortal = false,
}) {
  const listboxId = useId();
  const rootRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);

  const selected = useMemo(
    () => options.find((option) => String(option.value) === String(value)),
    [options, value]
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) => {
      const haystack = [option.label, option.hint, option.meta]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [options, query]);

  const showCreate =
    creatable &&
    Boolean(onCreateOption) &&
    query.trim().length > 0 &&
    !filtered.some((option) => option.label?.trim().toLowerCase() === query.trim().toLowerCase());

  const menuItems = useMemo(
    () =>
      buildMenuItems({
        filtered,
        clearable,
        showNone: !query.trim(),
        showCreate,
        createLabel,
        query,
        noneLabel,
      }),
    [filtered, clearable, query, showCreate, createLabel, noneLabel]
  );

  useLayoutEffect(() => {
    if (!open || !menuPortal) {
      setMenuStyle(null);
      return undefined;
    }

    function updateMenuPosition() {
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const maxHeight = 240;
      const gap = 4;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      const openUpward = spaceBelow < 160 && spaceAbove > spaceBelow;
      const availableHeight = Math.min(maxHeight, openUpward ? spaceAbove : spaceBelow);

      setMenuStyle({
        position: "fixed",
        left: rect.left,
        width: rect.width,
        maxHeight: Math.max(availableHeight, 120),
        zIndex: 5000,
        ...(openUpward
          ? { bottom: window.innerHeight - rect.top + gap }
          : { top: rect.bottom + gap }),
      });
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, menuPortal, menuItems.length]);

  useEffect(() => {
    if (!open) return undefined;

    function onDocumentMouseDown(event) {
      if (
        rootRef.current?.contains(event.target) ||
        dropdownRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
      setQuery("");
      setEditing(false);
    }

    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [query, menuItems.length]);

  function focusInput() {
    queueMicrotask(() => inputRef.current?.focus());
  }

  function openDropdown() {
    if (disabled) return;
    setOpen(true);
    setEditing(true);
    focusInput();
  }

  function closeDropdown() {
    setOpen(false);
    setQuery("");
    setEditing(false);
  }

  function selectItem(item) {
    if (item.type === "create") {
      handleCreate();
      return;
    }
    onChange?.(item.value === "" ? "" : String(item.value));
    closeDropdown();
  }

  async function handleCreate() {
    const term = query.trim();
    if (!term || !onCreateOption || creating) return;

    setCreating(true);
    try {
      const newValue = await onCreateOption(term);
      if (newValue != null && newValue !== "") {
        onChange?.(String(newValue));
      }
      closeDropdown();
    } finally {
      setCreating(false);
    }
  }

  function clearSelection(event) {
    event.preventDefault();
    event.stopPropagation();
    onChange?.("");
    setQuery("");
    openDropdown();
  }

  function onInputKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDropdown();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) openDropdown();
      setHighlight((index) => Math.min(index + 1, Math.max(menuItems.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      if (!open) {
        openDropdown();
        return;
      }
      event.preventDefault();
      const item = menuItems[highlight];
      if (item) selectItem(item);
      return;
    }

    if (event.key === "Backspace" && !query && selected && clearable) {
      onChange?.("");
    }
  }

  const showTag = selected && !editing && !open;

  const dropdown = open ? (
    <ul
      ref={dropdownRef}
      id={listboxId}
      className={`searchable-select-dropdown ${menuPortal ? "searchable-select-dropdown-portal" : ""}`}
      role="listbox"
      style={menuPortal ? menuStyle ?? { visibility: "hidden" } : undefined}
    >
      {menuItems.length === 0 && (
        <li className="searchable-select-empty">No matches</li>
      )}
      {menuItems.map((item, index) => (
        <li
          key={item.type === "option" ? item.value : item.type}
          role="option"
          aria-selected={item.type === "option" && String(item.value) === String(value)}
          className={[
            "searchable-select-option",
            item.type === "create" ? "create" : "",
            item.type === "option" && String(item.value) === String(value) ? "selected" : "",
            item.type === "none" && !value ? "selected" : "",
            highlight === index ? "highlight" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onMouseEnter={() => setHighlight(index)}
          onClick={() => selectItem(item)}
        >
          {item.type === "create" && <Plus size={14} aria-hidden="true" />}
          <span className="searchable-select-option-label">{item.label}</span>
          {item.hint && <span className="searchable-select-option-hint">{item.hint}</span>}
        </li>
      ))}
    </ul>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={`form-group searchable-select ${className} ${error ? "has-error" : ""}`}
    >
      {label && <label className="form-label">{label}</label>}

      <div
        className={`searchable-select-control ${open ? "open" : ""} ${disabled ? "disabled" : ""}`}
        onClick={() => {
          if (disabled) return;
          if (!open) openDropdown();
        }}
      >
        {showTag ? (
          <button
            type="button"
            className="searchable-select-tag"
            onClick={(event) => {
              event.stopPropagation();
              openDropdown();
            }}
          >
            <span className="searchable-select-tag-label">{selected.label}</span>
            {selected.hint && (
              <span className="searchable-select-tag-hint">{selected.hint}</span>
            )}
          </button>
        ) : (
          <>
            <Search size={16} className="searchable-select-icon" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              className="searchable-select-input"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
                setEditing(true);
              }}
              onFocus={() => {
                setOpen(true);
                setEditing(true);
              }}
              onKeyDown={onInputKeyDown}
              placeholder={placeholder}
              disabled={disabled || creating}
              autoComplete="off"
              role="combobox"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-autocomplete="list"
            />
          </>
        )}

        <div className="searchable-select-actions">
          {showTag && clearable && (
            <button
              type="button"
              className="searchable-select-clear"
              onClick={clearSelection}
              aria-label={`Clear ${label || "selection"}`}
            >
              <X size={14} />
            </button>
          )}
          <button
            type="button"
            className="searchable-select-chevron"
            tabIndex={-1}
            aria-label={open ? "Close list" : "Open list"}
            onClick={(event) => {
              event.stopPropagation();
              if (open) closeDropdown();
              else openDropdown();
            }}
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {menuPortal
        ? dropdown && createPortal(dropdown, document.body)
        : dropdown}

      {error && <span className="form-error">{error}</span>}
    </div>
  );
}
