interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      <p className="font-medium text-ink">{title}</p>
      <p className="text-sm text-muted">{description}</p>
    </div>
  );
}
