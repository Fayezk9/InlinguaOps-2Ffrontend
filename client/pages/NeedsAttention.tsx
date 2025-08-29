import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NeedsAttention() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
      <Card className="border-amber-500/60 bg-amber-900/20 text-amber-100">
        <CardHeader>
          <CardTitle>Needs Attention</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-100">Items that require action will appear here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
