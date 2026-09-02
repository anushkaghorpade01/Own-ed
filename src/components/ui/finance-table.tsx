import { cn } from "@/lib/cn";

interface FinanceTableProps {
  headers: React.ReactNode[];
  numericColumns?: number[];
  children: React.ReactNode;
  className?: string;
}

export function FinanceTable({ headers, children, className }: FinanceTableProps) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[480px] text-body-sm">
        <thead>
          <tr className="border-b border-[var(--border-default)]">
            {headers.map((h, i) => (
              <th
                key={i}
                className={cn(
                  "pb-2 pr-3 text-left text-label font-medium normal-case",
                  i > 0 && "text-right"
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function FinanceTableRow({
  cells,
  bold,
  className,
}: {
  cells: React.ReactNode[];
  bold?: boolean;
  className?: string;
}) {
  return (
    <tr className={cn("border-b border-[var(--border-subtle)]", className)}>
      {cells.map((cell, i) => (
        <td
          key={i}
          className={cn(
            "py-2 pr-3 text-[var(--text-secondary)]",
            i === 0 && "text-[var(--text-primary)]",
            i > 0 && "text-right text-tabular",
            bold && "font-semibold text-[var(--text-primary)]"
          )}
        >
          {cell}
        </td>
      ))}
    </tr>
  );
}
