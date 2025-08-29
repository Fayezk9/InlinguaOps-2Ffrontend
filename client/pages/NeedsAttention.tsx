import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NeedsAttention() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
      <Card className="border-orange-300 bg-orange-50">
        <CardHeader>
          <CardTitle>Needs Attention</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-orange-900">Items that require action will appear here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
