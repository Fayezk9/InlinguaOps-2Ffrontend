import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Settings() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Configure WooCommerce API access</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Set environment variables WC_BASE_URL, WC_CONSUMER_KEY and WC_CONSUMER_SECRET to enable live fetching.
            </p>
            <p>
              We recommend using environment variables in the deployment platform. You can set them via the dev server controls if needed.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
