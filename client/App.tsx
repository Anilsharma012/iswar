import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";

// Import pages
import Login from "@/pages/Login";
import Setup from "@/pages/Setup";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import Products from "@/pages/Products";
import Invoices from "@/pages/Invoices";
import Stock from "@/pages/Stock";
import Events from "@/pages/Events";
import EventDetails from "@/pages/EventDetails";
import Workers from "@/pages/Workers";
import Attendance from "@/pages/Attendance";
import Payroll from "@/pages/Payroll";
import Reports from "@/pages/Reports";
import IssueTracker from "@/pages/IssueTracker";
import NotFound from "@/pages/NotFound";

// Import layout
import DashboardLayout from "@/components/DashboardLayout";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-background">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/setup" element={<Setup />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <DashboardLayout />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="clients" element={<Clients />} />
              <Route path="products" element={<Products />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="stock" element={<Stock />} />
              <Route path="events" element={<Events />} />
              <Route path="event-details/:id" element={<EventDetails />} />
              <Route path="admin/events/:id/agreement" element={<EventAgreement />} />
              <Route path="admin/events/:id/dispatch" element={<PlaceholderPage title="Dispatch (Stock Out)" />} />
              <Route path="admin/events/:id/return" element={<PlaceholderPage title="Return (Stock In)" />} />
              <Route path="workers" element={<Workers />} />
              <Route path="attendance" element={<Attendance />} />
              <Route path="payroll" element={<Payroll />} />
              <Route path="reports" element={<Reports />} />
              <Route path="issue-tracker" element={<IssueTracker />} />
            </Route>

            {/* Catch all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>

          {/* Toast notifications */}
          <Toaster position="top-right" richColors />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
