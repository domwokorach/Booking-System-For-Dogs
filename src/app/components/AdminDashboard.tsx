import React from 'react';

export function AdminDashboard() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold font-serif mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-2">Customers</h2>
            <p className="text-muted-foreground">Manage customer records.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-2">Requests</h2>
            <p className="text-muted-foreground">Approve or reject requests.</p>
        </div>
      </div>
    </div>
  );
}
