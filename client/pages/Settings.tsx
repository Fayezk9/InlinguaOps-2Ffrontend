// Helpers for orders
function normalizeHeader(h: string) {
  return String(h || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseFlexibleToDDMMYYYY(input: string): string | null {
  const s = String(input || "").trim();
  const m1 = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (m1) {
    const dd = Math.max(1, Math.min(31, Number(m1[1])));
    const mm = Math.max(1, Math.min(12, Number(m1[2])));
    const yyyy = Number(m1[3]);
    const d = new Date(yyyy, mm - 1, dd);
    if (d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd) return `${String(dd).padStart(2,'0')}.${String(mm).padStart(2,'0')}.${yyyy}`;
    return null;
  }
  const digits = s.replace(/[^0-9]/g, "");
  if (digits.length === 8) {
    const dd = Number(digits.slice(0,2));
    const mm = Number(digits.slice(2,4));
    const yyyy = Number(digits.slice(4));
    const d = new Date(yyyy, mm - 1, dd);
    if (d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd) return `${String(dd).padStart(2,'0')}.${String(mm).padStart(2,'0')}.${yyyy}`;
  }
  return null;
}

function onlyDigits(s: string) { return String(s||"").replace(/\D+/g, ""); }

function colIndexToA1(index0: number): string {
  let n = index0 + 1; let s = "";
  while (n > 0) { const rem = (n - 1) % 26; s = String.fromCharCode(65 + rem) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function createSimplePdf(lines: string[]): Blob {
  const header = `%PDF-1.4\n`;
  const content = lines.map(l => l.replace(/\r|\n/g, '')).join("\n");
  const stream = `BT /F1 10 Tf 50 780 Td 12 TL (${content.replace(/([()\\])/g,'\\$1')}) Tj ET`;
  const streamBytes = new TextEncoder().encode(stream).length;
  const objects = [
    `1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n`,
    `2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n`,
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n`,
    `4 0 obj << /Length ${streamBytes} >> stream\n${stream}\nendstream endobj\n`,
    `5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n`,
  ];
  let xref: number[] = []; let body = header; let offset = header.length;
  for (const obj of objects) { xref.push(offset); body += obj; offset = body.length; }
  const xrefStart = body.length;
  body += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for (const off of xref) body += `${String(off).padStart(10,'0')} 00000 n \n`;
  body += `trailer << /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Blob([body], { type: 'application/pdf' });
}

function OrdersPanel({ current }: { current: string | null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grouped, setGrouped] = useState<Record<string, string[]>>({});

  const parseSheetId = (input: string) => {
    try { const u = new URL(input); const p = u.pathname.split('/'); const dIdx = p.indexOf('d'); return dIdx >= 0 ? p[dIdx + 1] : input; } catch { return input; }
  };

  async function load() {
    if (!current) { setError('No Google Sheet configured.'); return; }
    setLoading(true); setError(null);
    try {
      const sheetId = parseSheetId(current);
      const tabsRes = await fetch(`/api/sheets/tabs?id=${encodeURIComponent(sheetId)}`);
      if (!tabsRes.ok) throw new Error('tabs');
      const tabsJson = await tabsRes.json();
      const tabs: { title: string; gid: string }[] = tabsJson?.sheets || [];
      const out: Record<string, string[]> = {};
      for (const tab of tabs) {
        const sampleRes = await fetch(`/api/sheets/values?id=${encodeURIComponent(sheetId)}&title=${encodeURIComponent(tab.title)}&range=${encodeURIComponent('A1:ZZ200')}`);
        if (!sampleRes.ok) continue;
        const sampleJson = await sampleRes.json();
        const rows: string[][] = (sampleJson?.values as string[][]) || [];
        if (rows.length === 0) continue;
        const head = rows[0];
        const maxCols = Math.max(head.length, ...rows.map(r=>r.length, 0));
        const orderCandidates = new Set<number>();
        for (let i=0;i<maxCols;i++) {
          const h = normalizeHeader(head[i] || '');
          if (h.includes('bestell') || h.includes('order') || h.includes('b nr') || h.includes('bnr')) orderCandidates.add(i);
        }
        for (let c=0;c<maxCols;c++) {
          for (let r=1;r<rows.length;r++) { const d = onlyDigits(rows[r]?.[c] || ''); if (d.length === 4) { orderCandidates.add(c); break; } }
        }
        let dateIdx = head.findIndex(h=>{ const n = normalizeHeader(h); return n.includes('pdatum') || n.includes('p datum') || n.includes('prufungsdatum') || n.includes('exam date'); });
        if (dateIdx < 0) {
          for (let c=0;c<maxCols && dateIdx<0;c++) {
            for (let r=1;r<rows.length;r++) { if (parseFlexibleToDDMMYYYY(rows[r]?.[c] || '')) { dateIdx=c; break; } }
          }
        }
        if (orderCandidates.size === 0 || dateIdx < 0) continue;
        for (const oc of orderCandidates) {
          const col = colIndexToA1(oc);
          const dcol = colIndexToA1(dateIdx);
          const res = await fetch(`/api/sheets/values?id=${encodeURIComponent(sheetId)}&title=${encodeURIComponent(tab.title)}&range=${encodeURIComponent(`${col}1:${col}100000`)}`);
          const dres = await fetch(`/api/sheets/values?id=${encodeURIComponent(sheetId)}&title=${encodeURIComponent(tab.title)}&range=${encodeURIComponent(`${dcol}1:${dcol}100000`)}`);
          if (!res.ok || !dres.ok) continue;
          const json = await res.json(); const djson = await dres.json();
          const v: any[][] = json?.values || []; const dv: any[][] = djson?.values || [];
          for (let r=1;r<Math.max(v.length, dv.length); r++) {
            const order = onlyDigits(String(v[r]?.[0] ?? ''));
            const date = parseFlexibleToDDMMYYYY(String(dv[r]?.[0] ?? '')) || '';
            if (order.length === 4 && date) {
              if (!out[date]) out[date] = [];
              if (!out[date].includes(order)) out[date].push(order);
            }
          }
        }
      }
      for (const k of Object.keys(out)) out[k].sort();
      setGrouped(out);
    } catch (e: any) {
      setError(e?.message || 'Failed');
    }
    setLoading(false);
  }

  function downloadPdf() {
    const dates = Object.keys(grouped).sort((a,b)=>{
      const ap = a.split('.').reverse().join('');
      const bp = b.split('.').reverse().join('');
      return ap.localeCompare(bp);
    });
    const lines: string[] = [];
    lines.push('All Orders by Exam Date');
    lines.push('');
    for (const d of dates) { lines.push(`${d}`); lines.push(grouped[d].join(', ')); lines.push(''); }
    const blob = createSimplePdf(lines);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'all-orders-by-exam-date.pdf'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={load} disabled={!current || loading}>{loading ? 'Loading…' : 'Show list'}</Button>
        <Button variant="outline" onClick={downloadPdf} disabled={Object.keys(grouped).length===0}>Download list</Button>
      </div>
      {!current && <div className="text-sm text-muted-foreground text-center">Connect Google Sheet first in Settings &gt; Google Sheets.</div>}
      {error && <div className="text-sm text-red-500 text-center">{error}</div>}
      {Object.keys(grouped).length>0 && (
        <div className="mt-2 rounded border border-border p-3 max-h-96 overflow-auto themed-scroll">
          {Object.keys(grouped).sort().map(d => (
            <div key={d} className="mb-2">
              <div className="font-semibold">{d}</div>
              <div className="text-sm text-muted-foreground break-words">{grouped[d].join(', ')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
