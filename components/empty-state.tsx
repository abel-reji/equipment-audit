export function EmptyState({
  title,
  body,
  action
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel p-8 text-center">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-slate">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
