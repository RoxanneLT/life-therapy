import type { PageSection } from "@/lib/generated/prisma/client";
import { HeroSection } from "./sections/hero-section";
import { TextSection } from "./sections/text-section";
import { ImageTextSection } from "./sections/image-text-section";
import { CtaSection } from "./sections/cta-section";
import { TestimonialCarousel } from "./sections/testimonial-carousel";
import { CourseGrid } from "./sections/course-grid";
import { FeaturesSection } from "./sections/features-section";
import { FaqSection } from "./sections/faq-section";

type SectionComponent = React.ComponentType<{ section: PageSection }>;

const sectionComponents: Record<string, SectionComponent> = {
  hero: HeroSection,
  text: TextSection,
  image_text: ImageTextSection,
  cta: CtaSection,
  testimonial_carousel: TestimonialCarousel,
  course_grid: CourseGrid,
  features: FeaturesSection,
  faq: FaqSection,
};

interface SectionRendererProps {
  sections: PageSection[];
}

export function SectionRenderer({ sections }: SectionRendererProps) {
  return (
    <>
      {sections
        .filter((s) => s.isVisible)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((section) => {
          const Component = sectionComponents[section.sectionType];
          if (!Component) return null;
          return <Component key={section.id} section={section} />;
        })}
    </>
  );
}
