"use client";
import Alert from "@cloudscape-design/components/alert";
import Button from "@cloudscape-design/components/button";
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error;
  reset(): void;
}) {
  return (
    <Alert
      type="error"
      header="Route 53 could not load"
      action={<Button onClick={reset}>Try again</Button>}
    >
      {error.message}
    </Alert>
  );
}
