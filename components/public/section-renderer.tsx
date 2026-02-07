import type { PageSection } from "@/lib/generated/prisma/client";
import { HeroSection } from "./sections/hero-section";
import { TextSection } from "./sections/text-section";
import { ImageTextSection } from "./sections/image-text-section";
import { CtaSection } from "./sections/cta-section";
import { TestimonialCarousel } from "./sections/testimonial-carousel";
import { CourseGrid } from "./sections/course-grid";
import { FeaturesSection } from "./sections/features-section";
import { FaqSection } from "./sections/faq-section";
import { PricingSection } from "./sections/pricing-section";
import { StepsSection } from "./sections/steps-section";
import { CourseCatalog } from "./sections/course-catalog";
import { PackageGridSection } from "./sections/package-grid-section";

type SectionComponent = React.ComponentType<{
  section: PageSection;
  activeCategory?: string;
  viewMode?: string;
}>;

const sectionComponents: Record<string, SectionComponent> = {
  hero: HeroSection,
  text: TextSection,
  image_text: ImageTextSection,
  cta: CtaSection,
  testimonial_carousel: TestimonialCarousel,
  course_grid: CourseGrid,
  features: FeaturesSection,
  faq: FaqSection,
  pricing: PricingSection,
  steps: StepsSection,
  course_catalog: CourseCatalog as SectionComponent,
  bundle_grid: PackageGridSection,
  package_grid: PackageGridSection,
};

interface SectionRendererProps {
  sections: PageSection[];
  activeCategory?: string;
  viewMode?: string;
}

export function SectionRenderer({
  sections,
  activeCategory,
  viewMode,
}: SectionRendererProps) {
  return (
    <>
      {sections
        .filter((s) => s.isVisible)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((section) => {
          const Component = sectionComponents[section.sectionType];
          if (!Component) return null;
          return (
            <Component
              key={section.id}
              section={section}
              {...(section.sectionType === "course_catalog"
                ? { activeCategory, viewMode }
                : {})}
            />
          );
        })}
    </>
  );
}
