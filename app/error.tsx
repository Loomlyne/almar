"use client";

import { StatusFrame } from "../components/status-frame";
import { Button } from "../components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <StatusFrame title="This page did not load.">
      <Button variant="ghost" onClick={() => reset()}>
        Try again
      </Button>
    </StatusFrame>
  );
}
