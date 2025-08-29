import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrdersNew() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
      <Card className="border border-neutral-700 bg-neutral-900 text-white">
        <CardHeader>
          <CardTitle>Neue Bestellungen</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Placeholder for new orders UI.</p>
        </CardContent>
      </Card>
    </div>
  );
}
