import type { Region } from "./region";

interface RegionCopy {
  domain: string;
  siteUrl: string;
  contactEmail: string;
}

const COPY: Record<Region, RegionCopy> = {
  za: {
    domain: "life-therapy.co.za",
    siteUrl: "https://life-therapy.co.za",
    contactEmail: "hello@life-therapy.co.za",
  },
  int: {
    domain: "life-therapy.online",
    siteUrl: "https://life-therapy.online",
    contactEmail: "hello@life-therapy.co.za",
  },
};

export function getRegionCopy(region: Region): RegionCopy {
  return COPY[region];
}
