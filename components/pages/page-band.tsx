import type { ImageRef } from "../../lib/data/types";
import { BackgroundMedia } from "../ui/background-media";

/**
 * The hero band of Experiences and Contact (plan 06-02, signed pictures experiences-hero-photo and contact-hero-photo):
 * the photo the owner set in Content -> Pages, full width above the page's heading (4:3 on a phone, 16:6 from 768), with
 * the hero video playing over it when one is set. Nothing when neither is set, so the page is exactly as before.
 */
export function PageBand({ image, videoUrl }: { image: ImageRef | null; videoUrl: string | null }) {
  if (!image && !videoUrl) return null;
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-teal md:aspect-[16/6]">
      <BackgroundMedia poster={image ? { src: image.url, alt: image.alt } : null} videoUrl={videoUrl} />
    </div>
  );
}
