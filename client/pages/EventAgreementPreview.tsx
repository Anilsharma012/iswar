import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function EventAgreementPreview() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await eventAPI.getById(id!);
        const ev = res.data;
        if (!ev?.agreementSnapshot?.items?.length) {
          toast.info("No saved agreement");
          navigate(-1);
          return;
        }
        setEvent(ev);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load agreement preview");
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id, navigate]);

  const onPrint = () => window.print();

  const onDownload = async () => {
    try {
      const resp = await eventAPI.downloadAgreement(id!);
      const url = window.URL.createObjectURL(
        new Blob([resp.data], { type: "application/pdf" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `agreement-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error(e);
      toast.error(e.response?.data?.error || "Failed to download PDF");
    }
  };

  if (loading || !event) return <div className="p-6">Loading...</div>;

  const snap = event.agreementSnapshot;
  const rows = snap?.items?.length
    ? snap.items
    : event.dispatches && event.dispatches.length
      ? event.dispatches[event.dispatches.length - 1].items
      : event.selections || [];

  const subtotal = rows.reduce((s: number, it: any) => {
    const qty = Number(it.qtyToSend ?? it.qty ?? it.qtyReturned ?? 0);
    const rate = Number(it.rate ?? it.sellPrice ?? 0);
    const amount =
      typeof it.amount === "number" ? Number(it.amount) : Number((qty * rate).toFixed(2));
    return s + amount;
  }, 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Terms & Conditions / Agreement</h1>
        <div className="flex gap-2">
          <Button onClick={onPrint}>Print</Button>
          <Button onClick={onDownload}>Download PDF</Button>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Back
          </Button>
          <Button
            onClick={() => navigate(`/admin/events/${id}/agreement/sign`)}
          >
            Proceed to e-Sign
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client</CardTitle>
        </CardHeader>
        <CardContent>
          <div>{event.clientId?.name}</div>
          <div>{event.clientId?.phone}</div>
          {event.clientId?.address && <div>{event.clientId.address}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            Schedule: {new Date(event.dateFrom).toLocaleString("en-IN")} -{" "}
            {new Date(event.dateTo).toLocaleString("en-IN")}
          </div>
          {event.location && <div>Venue: {event.location}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Terms</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap">
            {snap?.terms || event.agreementTerms || ""}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((it: any, i: number) => {
                const qty = Number(
                  it.qtyToSend ?? it.qty ?? it.qtyReturned ?? 0,
                );
                const rate = Number(it.rate ?? it.sellPrice ?? 0);
                const amount = Number((qty * rate).toFixed(2));
                return (
                  <TableRow key={i}>
                    <TableCell>{it.name || it.productId?.name}</TableCell>
                    <TableCell>
                      {it.unitType || it.productId?.unitType}
                    </TableCell>
                    <TableCell>{qty}</TableCell>
                    <TableCell>₹{rate.toFixed(2)}</TableCell>
                    <TableCell>₹{amount.toFixed(2)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex justify-end mt-4">
            <div className="text-lg font-semibold">
              Subtotal: ₹{subtotal.toFixed(2)}
            </div>
          </div>
          <div className="flex justify-end mt-2">
            <div>Advance: ₹{Number(snap?.advance ?? event.advance ?? 0).toFixed(2)}</div>
          </div>
          <div className="flex justify-end mt-2">
            <div>Security: ₹{Number(snap?.security ?? event.security ?? 0).toFixed(2)}</div>
          </div>
          <div className="flex justify-end mt-2 font-bold text-lg">
            Grand Total: ₹
            {(
              Number(snap?.grandTotal ?? (subtotal - Number(snap?.advance ?? event.advance ?? 0) - Number(snap?.security ?? event.security ?? 0)))
            ).toFixed(2)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
