import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function History() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This page will show recent fetch sessions and saved results. Ask to add persistence if you want this implemented now.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
