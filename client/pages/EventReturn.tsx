import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { eventAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function EventReturn() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [damages, setDamages] = useState<number>(0);
  const [shortages, setShortages] = useState<number>(0);
  const [lateFee, setLateFee] = useState<number>(0);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const ev = await eventAPI.getById(id!);
        const data = ev.data;
        setEvent(data);
        const lastDispatch = data.dispatches?.[data.dispatches.length - 1];
        const items = lastDispatch?.items || data.selections || [];
        setRows(items.map((x: any) => ({ ...x, qty: x.qtyToSend || 0 })));

        const end = new Date(data.dateTo).getTime();
        const now = Date.now();
        if (now > end) {
          const diffDays = Math.ceil((now - end) / (1000 * 60 * 60 * 24));
          setLateFee(diffDays * 100); // simple daily fee
        }
      } catch (e) {
        console.error(e);
        toast.error('Failed to load return data');
      } finally {
        setLoading(false);
      }
    };
    if (id) run();
  }, [id]);

  const total = useMemo(() => rows.reduce((s, r) => s + (r.qty * (r.rate || 0)), 0) + damages + lateFee, [rows, damages, lateFee]);
  const formatINR = (n: number) => `₹${n.toFixed(2)}`;

  const updateRow = (i: number, patch: any) => {
    setRows(prev => {
      const next = [...prev];
      const r = { ...next[i], ...patch };
      if (r.qty < 0) r.qty = 0;
      next[i] = r;
      return next;
    });
  };

  const submit = async () => {
    try {
      const items = rows.filter(r => r.qty > 0).map(r => ({ productId: r.productId || r._id, name: r.name, sku: r.sku, unitType: r.unitType, qty: r.qty, rate: r.rate }));
      await eventAPI.return(id!, { items, shortages, damages, lateFee });
      toast.success('Return recorded');
      window.location.href = `/admin/events/${id}/return`;
    } catch (e: any) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Failed to return');
    }
  };

  if (loading || !event) return <div className="p-6"><div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"/></div></div>;

  return (
    <div className='space-y-6'>
      <h1 className='text-2xl font-bold'>Stock In (Return)</h1>
      <Card>
        <CardHeader><CardTitle>Returned Items</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Returned</TableHead>
                <TableHead>Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.qtyToSend || '-'}</TableCell>
                  <TableCell><Input type='number' className='w-24' value={r.qty} onChange={e => updateRow(i, { qty: Number(e.target.value) })} /></TableCell>
                  <TableCell><Input type='number' className='w-24' value={r.rate || 0} onChange={e => updateRow(i, { rate: Number(e.target.value) })} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mt-4'>
            <div>
              <label className='text-sm font-medium'>Shortages</label>
              <Input type='number' value={shortages} onChange={e => setShortages(Number(e.target.value))} />
            </div>
            <div>
              <label className='text-sm font-medium'>Damages (₹)</label>
              <Input type='number' value={damages} onChange={e => setDamages(Number(e.target.value))} />
            </div>
            <div>
              <label className='text-sm font-medium'>Late Fee (₹)</label>
              <Input type='number' value={lateFee} onChange={e => setLateFee(Number(e.target.value))} />
            </div>
          </div>

          <div className='flex justify-end mt-4 text-lg font-semibold'>Total Adjustments: {formatINR(total)}</div>
        </CardContent>
      </Card>

      <div className='flex justify-end gap-2'>
        <Button variant='outline' onClick={() => window.history.back()}>Back</Button>
        <Button onClick={submit}>Confirm Return</Button>
      </div>
    </div>
  );
}
