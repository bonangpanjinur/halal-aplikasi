import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const Icon = props.variant === "destructive" ? AlertCircle : 
                     props.variant === "success" ? CheckCircle2 : 
                     props.variant === "warning" ? AlertTriangle : Info;
        
        return (
          <Toast key={id} {...props}>
            <div className="flex gap-3">
              <Icon className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="grid gap-1">
                {title && <ToastTitle className="text-sm font-bold leading-none">{title}</ToastTitle>}
                {description && <ToastDescription className="text-xs opacity-90">{description}</ToastDescription>}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
