import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGetLoans, useApproveLoan, useDisburseLoan, useRejectLoan } from "@workspace/api-client-react";
import { Card, Button, Badge, Input, Label } from "@/components/ui/luxury";
import { formatCurrency, formatDate, playSound } from "@/lib/utils";
import { Search, CheckCircle, XCircle, Banknote, FileText, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Loans() {
  const [tab, setTab] = useState<"todos"|"por_aprobar"|"pend_desembolso"|"activos">("por_aprobar");
  const { data: loans = [], isLoading } = useGetLoans({});
  const [selectedLoan, setSelectedLoan] = useState<number | null>(null);
  const [showDisburse, setShowDisburse] = useState(false);

  // Map API statuses to our tabs
  const getFilteredLoans = () => {
    switch(tab) {
      case "por_aprobar": return loans.filter(l => l.status === "pending_approval");
      case "pend_desembolso": return loans.filter(l => l.status === "approved" || l.status === "pending_disbursement");
      case "activos": return loans.filter(l => l.status === "active");
      default: return loans;
    }
  };

  const filteredLoans = getFilteredLoans();
  const queryClient = useQueryClient();

  const approveMutation = useApproveLoan({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/loans"] }) }
  });

  const rejectMutation = useRejectLoan({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/loans"] }) }
  });

  const handleApprove = (id: number) => {
    approveMutation.mutate({ id });
  };

  const handleReject = (id: number) => {
    const reason = prompt("Motivo de rechazo:");
    if (reason) {
      rejectMutation.mutate({ id, data: { reason } });
    }
  };

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Préstamos</h1>
          <p className="text-muted-foreground mt-1">Gestión de solicitudes y créditos activos.</p>
        </div>
        <Button onClick={() => { playSound("bell"); alert("Modal Nueva Solicitud (Promotor)"); }}>
          Nueva Solicitud
        </Button>
      </div>

      <div className="flex gap-2 mb-6 border-b border-border pb-px">
        {[
          { id: "por_aprobar", label: "Por Aprobar" },
          { id: "pend_desembolso", label: "Pend. Desembolso" },
          { id: "activos", label: "Activos" },
          { id: "todos", label: "Todos" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLoans.map(loan => (
          <Card key={loan.id} className="p-6 flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className={`font-semibold text-lg ${loan.inDefault ? 'text-destructive' : 'text-foreground'}`}>
                  {loan.clientName}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">ID: #{loan.id.toString().padStart(5, '0')}</p>
              </div>
              <StatusBadge status={loan.status} />
            </div>

            <div className="space-y-3 flex-1">
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground text-sm">Capital</span>
                <span className="font-medium">{formatCurrency(loan.currentCapital)}</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground text-sm">Tasa</span>
                <span className="font-medium text-primary">{(loan.rate * 100).toFixed(1)}% {loan.periodicity === 'biweekly' ? 'Q' : 'M'}</span>
              </div>
              {loan.status === 'active' && (
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground text-sm">Próximo Corte</span>
                  <span className="font-medium text-amber-400">{formatDate(loan.nextCutDate)}</span>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-border flex gap-2">
              {loan.status === 'pending_approval' && (
                <>
                  <Button variant="outline" className="flex-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={() => handleApprove(loan.id)}>
                    <CheckCircle className="w-4 h-4 mr-2" /> Aprobar
                  </Button>
                  <Button variant="outline" className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => handleReject(loan.id)}>
                    <XCircle className="w-4 h-4 mr-2" /> Rechazar
                  </Button>
                </>
              )}
              {(loan.status === 'approved' || loan.status === 'pending_disbursement') && (
                <Button className="w-full" onClick={() => { setSelectedLoan(loan.id); setShowDisburse(true); }}>
                  <Banknote className="w-4 h-4 mr-2" /> Desembolsar
                </Button>
              )}
              {loan.status === 'active' && (
                <Button variant="secondary" className="w-full">
                  <FileText className="w-4 h-4 mr-2" /> Ver Detalles
                </Button>
              )}
            </div>
          </Card>
        ))}

        {filteredLoans.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed border-border rounded-2xl">
            <CreditCardIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No hay préstamos en esta categoría.</p>
          </div>
        )}
      </div>

      {showDisburse && selectedLoan && (
        <DisburseModal loanId={selectedLoan} onClose={() => { setShowDisburse(false); setSelectedLoan(null); }} />
      )}
    </AppLayout>
  );
}

function DisburseModal({ loanId, onClose }: { loanId: number, onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({ rate: 0.10, method: "Transferencia", periodicity: "biweekly" as any });
  
  const disburseMutation = useDisburseLoan({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
        onClose();
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    disburseMutation.mutate({ id: loanId, data: { rate: formData.rate, disbursementMethod: formData.method, periodicity: formData.periodicity } });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-display font-bold gold-gradient-text">Desembolsar Crédito</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tasa de Interés (Decimal, ej: 0.10 para 10%)</Label>
            <Input 
              type="number" step="0.01" required 
              className="text-primary font-bold border-primary/50 focus:border-primary"
              value={formData.rate} 
              onChange={e => setFormData({...formData, rate: parseFloat(e.target.value)})} 
            />
          </div>
          <div className="space-y-2">
            <Label>Método de Desembolso</Label>
            <select 
              className="flex h-12 w-full rounded-xl border border-border bg-background/50 px-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              value={formData.method}
              onChange={e => setFormData({...formData, method: e.target.value})}
            >
              <option value="Efectivo">Efectivo</option>
              <option value="Transferencia">Transferencia Bancaria</option>
              <option value="Yappy">Yappy</option>
            </select>
          </div>
          
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-4">Nota: Al desembolsar, el crédito pasará a estado Activo y comenzará a generar intereses según la tabla de la agencia.</p>
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button type="submit" isLoading={disburseMutation.isPending}>Confirmar Desembolso</Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string, variant: any }> = {
    'pending_approval': { label: 'Por Aprobar', variant: 'warning' },
    'approved': { label: 'Aprobado', variant: 'success' },
    'pending_disbursement': { label: 'Pend. Desembolso', variant: 'warning' },
    'active': { label: 'Activo', variant: 'success' },
    'rejected': { label: 'Rechazado', variant: 'destructive' },
    'settled': { label: 'Liquidado', variant: 'outline' },
  };
  const s = map[status] || { label: status, variant: 'default' };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

import { CreditCard as CreditCardIcon } from "lucide-react";
