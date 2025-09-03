import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

export default function AddressPostList() {
  const { t } = useI18n();
  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
      <Card className="border border-border bg-card text-card-foreground">
        <CardHeader>
          <CardTitle>{t("addressPostList", "Address Post List")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This section will contain tools to generate and manage postal
            address lists.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
