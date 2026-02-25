import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";

interface PlaceholderTabProps {
  title: string;
  description: string;
}

export function PlaceholderTab({ title, description }: PlaceholderTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center py-12 text-center">
          <Construction className="mb-4 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{description}</p>
          <p className="mt-1 text-xs text-muted-foreground/60">Coming in a future phase.</p>
        </div>
      </CardContent>
    </Card>
  );
}
