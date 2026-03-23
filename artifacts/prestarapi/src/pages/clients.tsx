import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGetClients, useCreateClient } from "@workspace/api-client-react";
import { Card, Button, Input, Label, Badge } from "@/components/ui/luxury";
import { formatCurrency } from "@/lib/utils";
import { Search, Plus, Phone, Building, User, FileText, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Clients() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const { data: clients = [], isLoading } = useGetClients({});

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone?.includes(search)
  );

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground mt-1">Gestión de cartera de clientes y saldos.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">Mensaje Masivo (WA)</Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Cliente
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nombre o teléfono..." 
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-background/50 border-b border-border">
              <tr>
                <th className="px-4 py-4 font-medium rounded-tl-xl">Cliente</th>
                <th className="px-4 py-4 font-medium">Agencia / Promotor</th>
                <th className="px-4 py-4 font-medium text-right">Saldo Capital</th>
                <th className="px-4 py-4 font-medium text-right">Int. Vigente</th>
                <th className="px-4 py-4 font-medium text-right">Int. Mora</th>
                <th className="px-4 py-4 font-medium text-center rounded-tr-xl">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => {
                const isMora = client.overdueInterest > 0;
                return (
                  <tr key={client.id} className="border-b border-border hover:bg-white/5 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className={`font-semibold ${isMora ? 'text-destructive' : 'text-foreground'}`}>
                          {client.name}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Phone className="w-3 h-3" /> {client.phone || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs flex items-center gap-1 text-muted-foreground">
                          <Building className="w-3 h-3 text-primary" /> {client.agencyName || 'Agencia Principal'}
                        </span>
                        <span className="text-xs flex items-center gap-1 text-muted-foreground">
                          <User className="w-3 h-3" /> {client.assignedToName || 'Sin asignar'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-medium">{formatCurrency(client.capitalBalance)}</td>
                    <td className="px-4 py-4 text-right text-primary">{formatCurrency(client.currentInterest)}</td>
                    <td className="px-4 py-4 text-right text-destructive">
                      {client.overdueInterest > 0 ? formatCurrency(client.overdueInterest) : '-'}
                      {client.overdueQuincenas > 0 && <span className="block text-[10px]">({client.overdueQuincenas} q.)</span>}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Button variant="ghost" size="sm" className="h-8">
                        <FileText className="w-4 h-4 mr-2" />
                        Estado Cta.
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No se encontraron clientes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showCreate && <CreateClientModal onClose={() => setShowCreate(false)} />}
    </AppLayout>
  );
}

function CreateClientModal({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({ name: "", phone: "", agencyId: 1, assignedToId: 1 });
  const queryClient = useQueryClient();
  const createMutation = useCreateClient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
        onClose();
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ data: { ...formData, phone2: "" } });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-display font-bold">Nuevo Cliente</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre Completo</Label>
            <Input 
              required 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
            />
          </div>
          <div className="space-y-2">
            <Label>Teléfono Celular</Label>
            <Input 
              required 
              type="tel"
              value={formData.phone} 
              onChange={e => setFormData({...formData, phone: e.target.value})} 
            />
          </div>
          
          {/* In a real app, these would be selects populated from API */}
          <div className="space-y-2">
            <Label>Agencia</Label>
            <select className="flex h-12 w-full rounded-xl border border-border bg-background/50 px-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary">
              <option value="1">Agencia Principal</option>
            </select>
          </div>

          <div className="pt-4 flex gap-3 justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" isLoading={createMutation.isPending}>Guardar Cliente</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
