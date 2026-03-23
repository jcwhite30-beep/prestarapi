import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { 
  LayoutDashboard, Users, CreditCard, Receipt, 
  Building2, UserCog, Landmark, CalendarDays, 
  ShieldAlert, Trash2, LogOut
} from "lucide-react";
import { UserRole } from "@workspace/api-client-react";

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout, hasRole } = useAuth();

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard, roles: [UserRole.superadmin, UserRole.admin, UserRole.manager, UserRole.promoter] },
    { name: "Clientes", path: "/clients", icon: Users, roles: [UserRole.superadmin, UserRole.admin, UserRole.manager, UserRole.promoter] },
    { name: "Préstamos", path: "/loans", icon: CreditCard, roles: [UserRole.superadmin, UserRole.admin, UserRole.manager, UserRole.promoter] },
    { name: "Pagos", path: "/payments", icon: Receipt, roles: [UserRole.superadmin, UserRole.admin, UserRole.manager, UserRole.promoter] },
    { name: "Agencias", path: "/agencies", icon: Building2, roles: [UserRole.superadmin, UserRole.admin] },
    { name: "Usuarios", path: "/users", icon: UserCog, roles: [UserRole.superadmin, UserRole.admin] },
    { name: "Fondeadores", path: "/funders", icon: Landmark, roles: [UserRole.superadmin, UserRole.admin] },
    { name: "Calendario", path: "/calendar", icon: CalendarDays, roles: [UserRole.superadmin, UserRole.admin, UserRole.manager] },
    { name: "Auditoría", path: "/audit", icon: ShieldAlert, roles: [UserRole.superadmin, UserRole.admin] },
    { name: "Papelera", path: "/trash", icon: Trash2, roles: [UserRole.superadmin, UserRole.admin] },
  ];

  return (
    <aside className="w-64 bg-card border-r border-border h-screen flex flex-col fixed left-0 top-0 z-40">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-[#B8860B] flex items-center justify-center shadow-lg shadow-primary/20">
          <span className="font-display font-bold text-background text-xl">P</span>
        </div>
        <span className="font-display font-bold text-xl gold-gradient-text tracking-wide">PrestaRapi</span>
      </div>

      <div className="px-6 pb-4">
        <div className="p-3 rounded-xl bg-background/50 border border-white/5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-primary font-bold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        {navItems.filter(item => hasRole(item.roles)).map((item) => {
          const isActive = location.startsWith(item.path);
          const Icon = item.icon;
          return (
            <Link key={item.path} href={item.path} className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
              isActive 
                ? "bg-primary/10 text-primary border border-primary/20" 
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            )}>
              <Icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <button 
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
