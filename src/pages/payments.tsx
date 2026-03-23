import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGetPayments, useReconcilePayment } from "../api-client";
import { Card, Button, Badge } from "@/components/ui/luxury";
import { formatCurrency, formatDate, playSound } from "@/lib/utils";
import { Receipt, CheckCircle, Image as ImageIcon, RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Payments() {
  const { data: payments = [], isLoading } = useGetPayments({});
  const queryClient = useQueryClient();

  const reconcileMutation = useReconcilePayment({
    mutation: {
      onSuccess: () => {
        playSound("cash");
        queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      }
    }
  });

  const handleReconcile = (id: number) => {
    if (confirm("¿Confirmar recepción de fondos y conciliar pago?")) {
      reconcileMutation.mutate({ id, data: {} });
    }
  };

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Conciliación de Pagos</h1>
          <p className="text-muted-foreground mt-1">Verifique comprobantes y aplique pagos al sistema.</p>
        </div>
        <Button>Registrar Pago Manual</Button>
      </div>

      <div className="space-y-4">
        {payments.map(payment => (
          <Card key={payment.id} className="p-0 overflow-hidden flex flex-col md:flex-row">
            <div className="p-6 flex-1 border-r border-border/50">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-lg text-foreground">{payment.clientName}</h3>
                <Badge variant={payment.status === 'reconciled' ? 'success' : 'warning'}>
                  {payment.status === 'reconciled' ? 'Conciliado' : 'Por Conciliar'}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                <span>Préstamo #{payment.loanId}</span>
                <span>•</span>
                <span>Registrado por: {payment.registeredByName}</span>
                <span>•</span>
                <span>{formatDate(payment.date)}</span>
              </div>
              
              <div className="bg-background/50 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Monto Reportado</p>
                  <p className="text-2xl font-display font-bold text-primary">{formatCurrency(payment.amount)}</p>
                </div>
                
                {payment.status === 'pending_reconciliation' && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <ImageIcon className="w-4 h-4 mr-2" /> Ver Comprobante
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => handleReconcile(payment.id)}
                      isLoading={reconcileMutation.isPending}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" /> Conciliar Pago
                    </Button>
                  </div>
                )}
                
                {payment.status === 'reconciled' && (
                  <div className="text-right">
                    <p className="text-xs text-emerald-400 mb-1">Aplicación del Sistema:</p>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Mora: {formatCurrency(payment.appliedOverdue || 0)}</p>
                      <p>Vigente: {formatCurrency(payment.appliedCurrent || 0)}</p>
                      <p>Capital: {formatCurrency(payment.appliedCapital || 0)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Mock Image Preview area */}
            <div className="w-full md:w-64 bg-black/40 flex items-center justify-center border-l border-border relative group min-h-[200px]">
              <Receipt className="w-12 h-12 text-muted-foreground/30" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button variant="outline" size="sm" className="bg-background/80">Ampliar</Button>
              </div>
            </div>
          </Card>
        ))}

        {payments.length === 0 && (
          <Card className="p-12 text-center text-muted-foreground">
            <Receipt className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No hay pagos registrados pendientes.</p>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
