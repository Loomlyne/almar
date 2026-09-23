import type { Metadata } from "next";
import { StatusFrame } from "../components/status-frame";
import { NOT_FOUND_TITLE } from "../lib/not-found-document";

export const metadata: Metadata = {
  title: NOT_FOUND_TITLE,
};

export default function NotFound() {
  return (
    <StatusFrame title="Page not found">
      <a className="ui-link" href="/">
        Return home
      </a>
    </StatusFrame>
  );
}
