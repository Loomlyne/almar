import { notFound } from "next/navigation";
import { DesignKit } from "./design-kit";

export default function DesignPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <DesignKit hasMapbox={Boolean(process.env.MAPBOX_ACCESS_TOKEN?.trim())} />;
}
