import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { eventAPI, productAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function EventDispatch() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const [ev, prods] = await Promise.all([
          eventAPI.getById(id!),
          productAPI.getAll({ limit: 1000 }),
        ]);
        setEvent(ev.data);
        const items = prods.data?.products || [];
        setRows(items.map((p: any) => ({ ...p, qty: 0, rate: p.sellPrice || 0, amount: 0 })));
      } catch (e) {
        console.error(e);
        toast.error('Failed to load dispatch data');
      } finally {
        setLoading(false);
      }
    };
    if (id) run();
  }, [id]);

  const total = useMemo(() => rows.reduce((s, r) => s + (r.qty * r.rate || 0), 0), [rows]);
  const formatINR = (n: number) => `₹${n.toFixed(2)}`;

  const updateRow = (i: number, patch: any) => {
    setRows(prev => {
      const next = [...prev];
      const r = { ...next[i], ...patch };
      if (r.qty < 0) r.qty = 0;
      if (r.qty > r.stockQty) { r.qty = r.stockQty; toast.warning('Qty cannot exceed stock'); }
      r.amount = Number((r.qty * r.rate).toFixed(2));
      next[i] = r;
      return next;
    });
  };

  const submit = async () => {
    try {
      const items = rows.filter(r => r.qty > 0).map(r => ({ productId: r._id, name: r.name, sku: r.sku, unitType: r.unitType, stockQty: r.stockQty, qty: r.qty, rate: r.rate }));
      await eventAPI.dispatch(id!, { items });
      toast.success('Dispatch recorded');
      window.location.href = `/admin/events/${id}/dispatch`;
    } catch (e: any) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Failed to dispatch');
    }
  };

  if (loading || !event) return <div className="p-6"><div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"/></div></div>;

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold'>Stock Out (Dispatch)</h1>
        <div className='text-sm text-muted-foreground'>Advance: {formatINR(event.advance || 0)}</div>
      </div>

      <Card>
        <CardHeader><CardTitle>Inventory</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r._id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.sku || '-'}</TableCell>
                  <TableCell>{r.unitType}</TableCell>
                  <TableCell>{r.stockQty}</TableCell>
                  <TableCell>
                    <div className='flex items-center gap-2'>
                      <Button variant='outline' size='sm' onClick={() => updateRow(i, { qty: Math.max(0, r.qty - 1) })}>-</Button>
                      <Input type='number' className='w-20' value={r.qty} onChange={e => updateRow(i, { qty: Number(e.target.value) })} />
                      <Button variant='outline' size='sm' onClick={() => updateRow(i, { qty: Math.min(r.stockQty, r.qty + 1) })}>+</Button>
                    </div>
                  </TableCell>
                  <TableCell><Input type='number' className='w-24' value={r.rate} onChange={e => updateRow(i, { rate: Number(e.target.value) })} /></TableCell>
                  <TableCell className='font-medium'>{formatINR(r.amount || 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className='flex justify-end mt-4 text-lg font-semibold'>Total: {formatINR(total)}</div>
        </CardContent>
      </Card>

      <div className='flex justify-end gap-2'>
        <Button variant='outline' onClick={() => window.history.back()}>Back</Button>
        <Button onClick={submit}>Confirm Dispatch</Button>
      </div>
    </div>
  );
}
