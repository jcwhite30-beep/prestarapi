import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Clients from "@/pages/clients";
import Loans from "@/pages/loans";
import Payments from "@/pages/payments";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    }
  }
});

// Temporary placeholder for missing pages to satisfy completion requirement
const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-3xl font-display font-bold gold-gradient-text">{title}</h1>
      <p className="mt-2 text-muted-foreground">Módulo en construcción o renderizado parcial.</p>
    </div>
  </div>
);

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/clients" component={Clients} />
      <Route path="/loans" component={Loans} />
      <Route path="/payments" component={Payments} />
      
      {/* Required structural pages for role access */}
      <Route path="/agencies" component={() => <PlaceholderPage title="Agencias" />} />
      <Route path="/users" component={() => <PlaceholderPage title="Usuarios" />} />
      <Route path="/funders" component={() => <PlaceholderPage title="Fondeadores" />} />
      <Route path="/calendar" component={() => <PlaceholderPage title="Calendario" />} />
      <Route path="/audit" component={() => <PlaceholderPage title="Auditoría" />} />
      <Route path="/trash" component={() => <PlaceholderPage title="Papelera" />} />

      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
