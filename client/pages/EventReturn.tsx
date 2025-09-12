import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { eventAPI } from "@/lib/api";
import { toast } from "sonner";

export default function EventReturn() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const ev = await eventAPI.getById(id!);
        const data = ev.data;
        setEvent(data);
            const lastDispatch = data.dispatches?.[data.dispatches.length - 1];
        const allItems = lastDispatch?.items || data.selections || [];

        // Only show outstanding lines (where returnedQty < qtyToSend)
        const outstanding = allItems.filter((x: any) => {
          const dispatched = Number(x.qtyToSend || x.qty || 0);
          const alreadyReturned = Number(x.returnedQty || 0);
          return dispatched - alreadyReturned > 0;
        });

        const mapped = outstanding.map((x: any) => {
          const dispatched = Number(x.qtyToSend || x.qty || 0);
          const alreadyReturned = Number(x.returnedQty || 0);
          const remaining = Math.max(0, dispatched - alreadyReturned);
          return {
            productId: x.productId || x._id,
            name: x.name,
            sku: x.sku,
            unitType: x.unitType,
            expected: dispatched,
            alreadyReturned,
            returned: remaining,
            shortage: Math.max(0, dispatched - (alreadyReturned + remaining)),
            damageAmount: 0,
            lateFee: 0,
            rate: Number(x.rate || 0),
            buyPrice: Number(x.buyPrice || 0),
            lossPrice: Number(x.lossPrice || 0),
            shortageCost: 0,
            lineAdjust: 0,
          };
        });

        // compute per-row late fee if event ended
        const end = new Date(data.dateTo).getTime();
        const now = Date.now();
        const perRowLate =
          now > end ? Math.ceil((now - end) / (1000 * 60 * 60 * 24)) * 100 : 0;
        if (perRowLate > 0) mapped.forEach((r) => (r.lateFee = perRowLate));

        mapped.forEach((r) => {
          r.shortage = Math.max(0, r.expected - r.returned);
          const lossPrice = r.lossPrice || r.buyPrice || r.rate || 0;
          r.shortageCost = Number((r.shortage * lossPrice).toFixed(2));
          r.lineAdjust = Number(
            (
              r.shortageCost +
              Number(r.damageAmount || 0) +
              Number(r.lateFee || 0)
            ).toFixed(2),
          );
        });

        setRows(mapped);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load return data");
      } finally {
        setLoading(false);
      }
    };
    if (id) run();
  }, [id]);

  const formatINR = (n: number) => `₹${n.toFixed(2)}`;

  const updateRow = (i: number, patch: any) => {
    setRows((prev) => {
      const next = [...prev];
      const r = { ...next[i], ...patch };
      if (r.returned < 0) r.returned = 0;
      if (r.returned > r.expected) r.returned = r.expected;
      r.shortage = Number(
        patch.shortage ?? Math.max(0, r.expected - r.returned),
      );
      const lossPrice = r.lossPrice || r.buyPrice || r.rate || 0;
      r.shortageCost = Number((r.shortage * lossPrice).toFixed(2));
      r.lineAdjust = Number(
        (
          r.shortageCost +
          Number(r.damageAmount || 0) +
          Number(r.lateFee || 0)
        ).toFixed(2),
      );
      next[i] = r;
      return next;
    });
  };

  const totalAdjust = useMemo(
    () => rows.reduce((s, r) => s + Number(r.lineAdjust || 0), 0),
    [rows],
  );

  const submit = async () => {
    try {
      const payloadItems = rows.map((r) => ({
        itemId: r.productId,
        expected: r.expected,
        returned: r.returned,
        shortage: r.shortage,
        damageAmount: r.damageAmount,
        lateFee: r.lateFee,
        lossPrice: r.lossPrice || r.buyPrice || r.rate || 0,
        shortageCost: r.shortageCost || 0,
        lineAdjust: r.lineAdjust || 0,
        rate: r.rate,
      }));

      await eventAPI.return(id!, { items: payloadItems });
      toast.success("Return recorded");
      window.location.href = `/invoices?new=1&eventId=${id}`;
    } catch (e: any) {
      console.error(e);
      toast.error(e.response?.data?.error || "Failed to return");
    }
  };

  if (loading || !event)
    return (
      <div className="p-6">
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Stock In (Return)</h1>
      <Card>
        <CardHeader>
          <CardTitle>Returned Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Returned</TableHead>
                <TableHead>Shortage</TableHead>
                <TableHead>Damages (₹)</TableHead>
                <TableHead>Late Fee (₹)</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Shortage Cost</TableHead>
                <TableHead>Line Adjust</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.expected || "-"}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="w-24"
                      value={r.returned}
                      onChange={(e) =>
                        updateRow(i, { returned: Number(e.target.value) })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="w-24"
                      value={r.shortage}
                      onChange={(e) =>
                        updateRow(i, { shortage: Number(e.target.value) })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="w-24"
                      value={r.damageAmount}
                      onChange={(e) =>
                        updateRow(i, { damageAmount: Number(e.target.value) })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="w-24"
                      value={r.lateFee}
                      onChange={(e) =>
                        updateRow(i, { lateFee: Number(e.target.value) })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="w-24"
                      value={r.rate || 0}
                      onChange={(e) =>
                        updateRow(i, { rate: Number(e.target.value) })
                      }
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatINR(r.shortageCost || 0)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatINR(r.lineAdjust || 0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-end mt-4 text-lg font-semibold">
            Total Adjustments: {formatINR(totalAdjust)}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => window.history.back()}>
          Back
        </Button>
        <Button onClick={submit}>Confirm Return</Button>
      </div>
    </div>
  );
}
