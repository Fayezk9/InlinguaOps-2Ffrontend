import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useI18n } from "@/lib/i18n";

export default function Teilnahme() {
  const { t } = useI18n();
  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
      <Card>
        <CardHeader>
          <CardTitle>{t('participationConfirmation','Participation Confirmation')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Placeholder for participation confirmation tools.</p>
        </CardContent>
      </Card>
    </div>
  );
}
