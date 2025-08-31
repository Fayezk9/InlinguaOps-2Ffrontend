import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useI18n } from "@/lib/i18n";

export default function Anmelde() {
  const { t } = useI18n();
  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
      <Card className="border border-border bg-card text-card-foreground">
        <CardHeader>
          <CardTitle>{t('registrationConfirmation','Registration Confirmation')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Placeholder for registration confirmation tools.</p>
        </CardContent>
      </Card>
    </div>
  );
}
