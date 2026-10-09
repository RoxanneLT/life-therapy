import { BackLink } from "./back-link";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** A back link rendered above the title. */
  back?: { href: string; to: string };
}

export function PageHeader({ title, description, action, back }: PageHeaderProps) {
  return (
    <div className="space-y-2">
      {back && <BackLink href={back.href} to={back.to} />}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}
