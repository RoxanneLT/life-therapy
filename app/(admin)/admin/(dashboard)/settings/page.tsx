export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Site settings will be available in a future update.
        </p>
      </div>
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-muted-foreground">
          Site-wide settings (contact info, social links, SEO defaults) coming
          in Phase 2.
        </p>
      </div>
    </div>
  );
}
