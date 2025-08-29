import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Pruefungen() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
      <Card>
        <CardHeader>
          <CardTitle>Prüfungen</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Placeholder for exams management.</p>
        </CardContent>
      </Card>
    </div>
  );
}
