import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function Teilnehmer() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
      <Card className="border border-border bg-card text-card-foreground">
        <CardHeader>
          <CardTitle>Manage Participants</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link to="/anmelde"><Button>Registration Confirmation</Button></Link>
            <Link to="/teilnahme"><Button variant="secondary">Participation Confirmation</Button></Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
