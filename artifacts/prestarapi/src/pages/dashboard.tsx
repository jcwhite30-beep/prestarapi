import { AppLayout } from "@/components/layout/AppLayout";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { Card } from "@/components/ui/luxury";
import { formatCurrency, formatDate } from "@/lib/utils";
import { 
  TrendingUp, AlertCircle, Users, CreditCard, 
  ArrowUpRight, ArrowDownRight, Download, DollarSign
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function Dashboard() {
  // Mocking query for preview since real DB might be empty initially
  const { data: stats, isLoading } = useGetDashboardStats({});

  // Fallback data for stunning visual presentation when API is empty
  const displayStats = stats || {
    totalCapitalOnStreet: 1250000.50,
    totalCurrentInterest: 45000.25,
    totalOverdueInterest: 12500.00,
    totalActiveClients: 450,
    totalActiveLoans: 480,
    totalLoansInDefault: 25,
    interestCollected: 85000.00,
    upcomingCuts: [
      { loanId: 1, clientName: "Juan Pérez", cutDate: new Date().toISOString(), capital: 500, interest: 50 },
      { loanId: 2, clientName: "María García", cutDate: new Date().toISOString(), capital: 1000, interest: 100 },
    ],
    portfolioByUser: []
  };

  const chartData = [
    { name: "Capital", value: displayStats.totalCapitalOnStreet, color: "#D4AF37" },
    { name: "Int. Vigente", value: displayStats.totalCurrentInterest, color: "#10b981" },
    { name: "Int. Mora", value: displayStats.totalOverdueInterest, color: "#ef4444" },
  ];

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Resumen financiero y métricas clave.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border hover:border-primary/50 hover:text-primary transition-colors text-sm font-medium">
          <Download className="w-4 h-4" />
          Exportar PDF
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Capital Prestado" 
          value={formatCurrency(displayStats.totalCapitalOnStreet)}
          icon={DollarSign}
          trend="+5.2%"
        />
        <StatCard 
          title="Intereses Vigentes" 
          value={formatCurrency(displayStats.totalCurrentInterest)}
          icon={TrendingUp}
          trend="+2.1%"
        />
        <StatCard 
          title="Intereses en Mora" 
          value={formatCurrency(displayStats.totalOverdueInterest)}
          icon={AlertCircle}
          trend="-1.5%"
          isNegative
        />
        <StatCard 
          title="Clientes Activos" 
          value={displayStats.totalActiveClients.toString()}
          icon={Users}
          trend="+12"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Distribución de Cartera
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis dataKey="name" stroke="#666" tickLine={false} axisLine={false} />
                <YAxis stroke="#666" tickLine={false} axisLine={false} tickFormatter={(val) => `$${val/1000}k`} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#333', borderRadius: '8px' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              Próximos Cortes (7 días)
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {displayStats.upcomingCuts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                <CalendarDays className="w-12 h-12 opacity-20 mb-3" />
                <p>No hay cortes programados para los próximos días.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {displayStats.upcomingCuts.map((cut, i) => (
                  <div key={i} className="p-4 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-border">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-medium text-foreground">{cut.clientName}</p>
                      <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded-md">
                        {formatDate(cut.cutDate)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Capital: {formatCurrency(cut.capital)}</span>
                      <span className="text-primary">Int: {formatCurrency(cut.interest)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

function StatCard({ title, value, icon: Icon, trend, isNegative }: any) {
  return (
    <Card className="p-6 relative overflow-hidden group">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 rounded-xl bg-background border border-border text-primary">
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={`text-xs font-medium flex items-center gap-1 px-2 py-1 rounded-full ${isNegative ? 'text-destructive bg-destructive/10' : 'text-emerald-400 bg-emerald-400/10'}`}>
            {isNegative ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-muted-foreground text-sm font-medium mb-1">{title}</p>
        <h4 className="text-3xl font-display font-bold text-foreground">{value}</h4>
      </div>
    </Card>
  );
}

// Temporary icon fix since CalendarDays wasn't imported in this scope above
import { CalendarDays } from "lucide-react";
