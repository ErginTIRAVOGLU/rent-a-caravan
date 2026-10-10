"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";

type SiteImageProps = Omit<ImageProps, "src" | "onError"> & {
  src: ImageProps["src"];
  fallbackSrc?: ImageProps["src"];
};

export function SiteImage({ src, alt, fallbackSrc = "/images/photo-fallback.svg", ...props }: SiteImageProps) {
  const [failedSource, setFailedSource] = useState<ImageProps["src"] | null>(null);
  const displayedSource = failedSource === src ? fallbackSrc : src;
  return <Image {...props} alt={alt} src={displayedSource} onError={() => setFailedSource(src)} />;
}
