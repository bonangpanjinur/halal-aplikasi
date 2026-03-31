import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.logErrorToSupabase(error, errorInfo);
  }

  private async logErrorToSupabase(error: Error, errorInfo: ErrorInfo) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("error_logs" as any).insert({
        user_id: user?.id,
        severity: "major",
        category: "ui",
        message: error.message,
        stack_trace: error.stack + "\n\nComponent Stack:\n" + errorInfo.componentStack,
        context: {
          url: window.location.href,
          userAgent: navigator.userAgent,
        }
      });
    } catch (e) {
      console.error("Failed to log error to Supabase:", e);
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[400px] w-full flex-col items-center justify-center p-6 text-center">
          <div className="mb-6 rounded-full bg-destructive/10 p-4 text-destructive">
            <AlertTriangle className="h-12 w-12" />
          </div>
          <h2 className="mb-2 text-2xl font-bold tracking-tight">Ups, terjadi kesalahan!</h2>
          <p className="mb-8 max-w-md text-muted-foreground">
            Aplikasi mengalami kendala teknis yang tidak terduga. Kami telah mencatat kejadian ini untuk segera diperbaiki.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button 
              variant="default" 
              onClick={() => window.location.reload()}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Muat Ulang Halaman
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.href = "/dashboard"}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              Kembali ke Dashboard
            </Button>
          </div>
          <div className="mt-8 w-full max-w-2xl overflow-auto rounded-lg bg-muted p-4 text-left font-mono text-xs">
            <p className="font-bold text-destructive mb-2">{this.state.error?.toString()}</p>
            <pre className="whitespace-pre-wrap opacity-70">
              {this.state.error?.stack}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
