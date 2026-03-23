import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { Card, Input, Label, Button } from "@/components/ui/luxury";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, Lock, User } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data: any) => {
        if (data.token) {
          localStorage.setItem("prestarapi_token", data.token);
        }
        queryClient.setQueryData(["/api/auth/me"], data.user);
        setLocation("/dashboard");
      },
      onError: () => {
        setError("Credenciales inválidas. Por favor intente de nuevo.");
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate({ data: { username, password } });
  };

  return (
    <div className="min-h-screen w-full flex bg-background relative overflow-hidden">
      {/* Background graphic elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/20 blur-[120px]" />
      </div>

      <div className="flex-1 flex items-center justify-center z-10 p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-[#B8860B] flex items-center justify-center shadow-xl shadow-primary/20 mb-6">
              <span className="font-display font-bold text-background text-4xl">P</span>
            </div>
            <h1 className="text-4xl font-display font-bold text-foreground mb-2">Presta<span className="gold-gradient-text">Rapi</span></h1>
            <p className="text-muted-foreground text-sm tracking-wide uppercase">Sistema de Gestión de Préstamos</p>
          </div>

          <Card className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>Usuario</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                  <Input 
                    placeholder="Ingrese su usuario" 
                    className="pl-10"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Contraseña</Label>
                  <a href="#" className="text-xs text-primary hover:underline">¿Olvidó su contraseña?</a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                  <Input 
                    type="password"
                    placeholder="••••••••" 
                    className="pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" isLoading={loginMutation.isPending}>
                Ingresar al Sistema
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
