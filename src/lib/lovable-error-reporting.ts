type ErrorReportOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type EditorEvents = {
  track?: (event: string, properties?: Record<string, unknown>) => string | null;
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: ErrorReportOptions,
  ) => void;
};

declare global {
  interface Window {
    __lovableEvents?: EditorEvents;
    __lovableReportRuntimeError?: (payload: {
      message: string;
      stack?: string;
      filename?: string;
    }) => void;
  }
}

export function reportApplicationError(_error: unknown, _context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const safeError = new Error("An application error occurred.");
  delete safeError.stack;
  window.__lovableEvents?.captureException?.(
    safeError,
    {
      source: "react_error_boundary",
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
  // Prod React does not rethrow boundary-caught errors to window.onerror, so the
  // editor's telemetry never sees them. Forward to the editor's reporting hook,
  // which is present only inside the editor preview.
  window.__lovableReportRuntimeError?.({
    message: "An application error occurred.",
  });
}
