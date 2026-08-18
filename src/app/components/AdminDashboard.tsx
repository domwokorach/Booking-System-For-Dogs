import React, { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/adminApi';

type Booking = {
  id: string;
  dateTime: string;
  bookingStatus: string;
  customer: {
    name: string;
    email: string;
    customerReference: string;
  };
  service: string | null;
  paymentStatus: string | null;
  amountPence: number | null;
  currency: string | null;
  paidAt: string | null;
};

function splitWords(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function formatMoney(amountPence: number | null, currency: string | null): string {
  if (amountPence === null || !currency) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountPence / 100);
}

const bookingStatusStyles: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-800',
  Confirmed: 'bg-emerald-100 text-emerald-800',
  Rescheduled: 'bg-blue-100 text-blue-800',
  CancellationPending: 'bg-orange-100 text-orange-800',
  Cancelled: 'bg-red-100 text-red-800',
  Completed: 'bg-slate-100 text-slate-800',
};

const paymentStatusStyles: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-800',
  Paid: 'bg-emerald-100 text-emerald-800',
  Failed: 'bg-red-100 text-red-800',
  Expired: 'bg-slate-100 text-slate-800',
  RefundPending: 'bg-orange-100 text-orange-800',
  Refunded: 'bg-blue-100 text-blue-800',
  RefundFailed: 'bg-red-100 text-red-800',
};

function StatusBadge({ value, styles }: { value: string; styles: Record<string, string> }) {
  const className = styles[value] ?? 'bg-slate-100 text-slate-800';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {splitWords(value)}
    </span>
  );
}

export function AdminDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await adminFetch('/admin/bookings');
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const data = (await response.json()) as Booking[];
        if (!cancelled) setBookings(data);
      } catch {
        if (!cancelled) setError('Unable to load bookings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold font-serif mb-6">Admin Dashboard</h1>

      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-6 pb-4">
          <h2 className="text-xl font-bold">Bookings</h2>
          <p className="text-muted-foreground text-sm">Booking status and payment status update automatically from Stripe.</p>
        </div>

        {loading && <p className="px-6 pb-6 text-muted-foreground">Loading bookings…</p>}
        {error && <p className="px-6 pb-6 text-destructive">{error}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-border text-left text-muted-foreground">
                  <th className="px-6 py-3 font-medium">Customer</th>
                  <th className="px-6 py-3 font-medium">Service</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Booking Status</th>
                  <th className="px-6 py-3 font-medium">Payment Status</th>
                  <th className="px-6 py-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-6 text-center text-muted-foreground">
                      No bookings yet.
                    </td>
                  </tr>
                )}
                {bookings.map((booking) => (
                  <tr key={booking.id} className="border-t border-border">
                    <td className="px-6 py-3">
                      <div className="font-medium">{booking.customer.name}</div>
                      <div className="text-muted-foreground text-xs">{booking.customer.email}</div>
                    </td>
                    <td className="px-6 py-3">{booking.service ?? '—'}</td>
                    <td className="px-6 py-3">
                      {new Date(booking.dateTime).toLocaleString('en-GB', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge value={booking.bookingStatus} styles={bookingStatusStyles} />
                    </td>
                    <td className="px-6 py-3">
                      {booking.paymentStatus ? (
                        <StatusBadge value={booking.paymentStatus} styles={paymentStatusStyles} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3">{formatMoney(booking.amountPence, booking.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
