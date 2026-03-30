"use client";

import { type ReactNode, useState, useMemo } from "react";
import { clsx } from "clsx";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

// ──────────────────────────────────────────────
// Table Components
// ──────────────────────────────────────────────

export function Table({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("overflow-x-auto rounded-xl border border-gray-800/60", className)}>
      <table className="w-full text-left">{children}</table>
    </div>
  );
}

export function TableHead({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <thead className={clsx("bg-surface-200/50", className)}>{children}</thead>
  );
}

export function TableBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <tbody className={clsx("divide-y divide-gray-800/40", className)}>{children}</tbody>;
}

export function TableRow({
  children,
  className,
  onClick,
  hoverable = true,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}) {
  return (
    <tr
      className={clsx(
        hoverable && "hover:bg-surface-200/40 transition-colors duration-100",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function TableHeaderCell({
  children,
  className,
  sortable = false,
  sortDirection,
  onSort,
}: {
  children: ReactNode;
  className?: string;
  sortable?: boolean;
  sortDirection?: "asc" | "desc" | null;
  onSort?: () => void;
}) {
  return (
    <th
      className={clsx(
        "px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider",
        sortable && "cursor-pointer select-none hover:text-gray-300 transition-colors",
        className
      )}
      onClick={sortable ? onSort : undefined}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortable && (
          <span className="flex flex-col -space-y-1">
            <ChevronUp
              className={clsx(
                "w-3 h-3",
                sortDirection === "asc" ? "text-lurk-400" : "text-gray-600"
              )}
            />
            <ChevronDown
              className={clsx(
                "w-3 h-3",
                sortDirection === "desc" ? "text-lurk-400" : "text-gray-600"
              )}
            />
          </span>
        )}
      </div>
    </th>
  );
}

export function TableCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={clsx("px-4 py-3 text-sm text-gray-300", className)}>
      {children}
    </td>
  );
}

// ──────────────────────────────────────────────
// Pagination
// ──────────────────────────────────────────────

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: PaginationProps) {
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800/60">
      <span className="text-xs text-gray-500">
        Showing {start}-{end} of {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-1 rounded hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsLeft className="w-4 h-4 text-gray-400" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1 rounded hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-gray-400" />
        </button>
        <span className="px-3 py-1 text-xs text-gray-400">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1 rounded hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-1 rounded hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsRight className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// DataTable (High-Level)
// ──────────────────────────────────────────────

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (item: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  pageSize?: number;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyExtractor,
  pageSize = 10,
  onRowClick,
  emptyMessage = "No data available",
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = sortedData.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800/60 p-12 text-center">
        <p className="text-sm text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div>
      <Table>
        <TableHead>
          <tr>
            {columns.map((col) => (
              <TableHeaderCell
                key={col.key}
                sortable={col.sortable}
                sortDirection={sortKey === col.key ? sortDir : null}
                onSort={() => handleSort(col.key)}
                className={col.className}
              >
                {col.header}
              </TableHeaderCell>
            ))}
          </tr>
        </TableHead>
        <TableBody>
          {paginatedData.map((item) => (
            <TableRow
              key={keyExtractor(item)}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
            >
              {columns.map((col) => (
                <TableCell key={col.key} className={col.className}>
                  {col.render
                    ? col.render(item)
                    : (item[col.key] as ReactNode)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={sortedData.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
