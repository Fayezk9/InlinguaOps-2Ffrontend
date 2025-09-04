import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

type Exam = { id: number; kind: string; date: string };

export default function Pruefungen() {
  const { t } = useI18n();
  const [openMgmt, setOpenMgmt] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const [openRemove, setOpenRemove] = useState(false);
  const [openList, setOpenList] = useState(false);
  const [openCert, setOpenCert] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [addKind, setAddKind] = useState("B1");
  const [addDates, setAddDates] = useState<string>("");

  const [filterKind, setFilterKind] = useState<string>("");
  const [exams, setExams] = useState<Exam[]>([]);
  const [selected, setSelected] = useState<number[]>([]);

  const [certSite, setCertSite] = useState<string>("");

  async function refresh(kind?: string) {
    const url = new URL("/api/exams", window.location.origin);
    if (kind) url.searchParams.set("kind", kind);
    const res = await fetch(url);
    if (res.ok) {
      const j = await res.json();
      setExams(j.exams || []);
    }
  }

  useEffect(() => {
    refresh();
    fetch("/api/exams/config").then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (j?.certSite) setCertSite(j.certSite);
    });
  }, []);

  const parsedDates = useMemo(() => {
    return addDates
      .split(/\n|,|;/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [addDates]);

  const submitAdd = async () => {
    const res = await fetch("/api/exams/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: addKind, dates: parsedDates }),
    });
    if (res.ok) {
      setOpenAdd(false);
      setAddDates("");
      await refresh();
    }
  };

  const submitRemove = async () => {
    const res = await fetch("/api/exams/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selected }),
    });
    if (res.ok) {
      setOpenRemove(false);
      setSelected([]);
      await refresh(filterKind || undefined);
    }
  };

  const onOpenCert = async () => {
    if (!certSite) setOpenCert(true);
    else setConfirmOpen(true);
  };

  const saveCertSite = async () => {
    const url = certSite.trim();
    const res = await fetch("/api/exams/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ certSite: url }),
    });
    if (res.ok) setOpenCert(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-16">
      <Card className="border border-border bg-card text-card-foreground">
        <CardHeader>
          <CardTitle>{t("exams", "Exams")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 items-center">
            <Button onClick={() => setOpenMgmt(true)}>Exam Management</Button>
            <Button variant="secondary" onClick={onOpenCert}>Certificate Management</Button>
          </div>
        </CardContent>
      </Card>

      {/* Exam Management window */}
      <Dialog open={openMgmt} onOpenChange={setOpenMgmt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exam Management</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 items-center">
            <Button onClick={() => setOpenAdd(true)}>Add Exam</Button>
            <Button variant="secondary" onClick={() => { setFilterKind(""); refresh(); setOpenRemove(true); }}>Remove Exam</Button>
            <Button variant="outline" onClick={() => { setFilterKind(""); refresh(); setOpenList(true); }}>Show List</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Exam */}
      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Exam</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Exam Kind</label>
              <select className="border rounded-md px-3 py-2" value={addKind} onChange={(e) => setAddKind(e.target.value)}>
                <option value="B1">B1</option>
                <option value="B2">B2</option>
                <option value="C1">C1</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Exam Dates (one per line)</label>
              <textarea className="border rounded-md px-3 py-2 min-h-[120px]" value={addDates} onChange={(e) => setAddDates(e.target.value)} placeholder="2025-01-31\n2025-02-15" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitAdd} disabled={parsedDates.length === 0}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Exam */}
      <Dialog open={openRemove} onOpenChange={setOpenRemove}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Remove Exam</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-sm">Filter by Kind</label>
              <select className="border rounded-md px-2 py-1" value={filterKind} onChange={async (e) => { const v = e.target.value; setFilterKind(v); await refresh(v || undefined); }}>
                <option value="">All</option>
                <option value="B1">B1</option>
                <option value="B2">B2</option>
                <option value="C1">C1</option>
              </select>
            </div>
            <div className="max-h-64 overflow-auto rounded-md border p-2">
              {exams.map((ex) => (
                <label key={ex.id} className="flex items-center gap-2 py-1">
                  <input type="checkbox" checked={selected.includes(ex.id)} onChange={(e) => {
                    setSelected((prev) => e.target.checked ? [...prev, ex.id] : prev.filter((x) => x !== ex.id));
                  }} />
                  <span className="text-sm w-10 font-mono">{ex.kind}</span>
                  <span className="text-sm">{new Date(ex.date).toLocaleDateString()}</span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={submitRemove} disabled={selected.length === 0}>Delete Selected</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show List */}
      <Dialog open={openList} onOpenChange={setOpenList}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Exams List</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => { setFilterKind(""); refresh(); }}>Show All</Button>
              <span className="text-sm">or filter:</span>
              <select className="border rounded-md px-2 py-1" value={filterKind} onChange={async (e) => { const v = e.target.value; setFilterKind(v); await refresh(v || undefined); }}>
                <option value="">All</option>
                <option value="B1">B1</option>
                <option value="B2">B2</option>
                <option value="C1">C1</option>
              </select>
            </div>
            <div className="max-h-64 overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b">
                    <th className="text-left px-2 py-1">Kind</th>
                    <th className="text-left px-2 py-1">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map((ex) => (
                    <tr key={ex.id} className="border-b last:border-b-0">
                      <td className="px-2 py-1 font-mono">{ex.kind}</td>
                      <td className="px-2 py-1">{new Date(ex.date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Certificate Management */}
      <Dialog open={openCert} onOpenChange={setOpenCert}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Certificate Management</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium">Certificate Website</label>
            <Input placeholder="https://example.com" value={certSite} onChange={(e) => setCertSite(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={saveCertSite} disabled={!certSite}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm open website */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open certificate website?</DialogTitle>
          </DialogHeader>
          <div className="text-sm">{certSite}</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={() => { setConfirmOpen(false); window.open(certSite, "_blank", "noopener,noreferrer"); }}>Open</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
