import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // ── Pages ────────────────────────────────────────────────
  const pages = await Promise.all(
    [
      { title: "Home", slug: "home", description: "Homepage", isPublished: true, sortOrder: 0 },
      { title: "About Roxanne", slug: "about", description: "About page", isPublished: true, sortOrder: 1 },
      { title: "1:1 Online Sessions", slug: "sessions", description: "Sessions page", isPublished: true, sortOrder: 2 },
      { title: "Self-Paced Courses", slug: "courses", description: "Courses page", isPublished: true, sortOrder: 3 },
      { title: "Bundles & Packages", slug: "packages", description: "Packages page", isPublished: true, sortOrder: 4 },
      { title: "Book a Session", slug: "book", description: "Booking page", isPublished: true, sortOrder: 5 },
      { title: "Contact", slug: "contact", description: "Contact page", isPublished: true, sortOrder: 6 },
    ].map((page) =>
      prisma.page.upsert({
        where: { slug: page.slug },
        update: { title: page.title, isPublished: page.isPublished },
        create: page,
      })
    )
  );

  const homePage = pages[0];

  // ── Homepage Sections ────────────────────────────────────
  await prisma.pageSection.deleteMany({ where: { pageId: homePage.id } });
  await prisma.pageSection.createMany({
    data: [
      {
        pageId: homePage.id,
        sectionType: "hero",
        title: "Master Your Confidence. Transform Your Life.",
        subtitle:
          "Online life coaching, counselling, and self-paced courses — empowering you to build confidence, manage stress, and create meaningful change from anywhere in the world.",
        imageUrl: "/images/hero-home.jpg",
        ctaText: "Explore Our Courses",
        ctaLink: "/courses",
        config: { ctaSecondaryText: "Book a Free Consultation", ctaSecondaryLink: "/book" },
        sortOrder: 0,
      },
      {
        pageId: homePage.id,
        sectionType: "text",
        title: "Your Growth Journey Starts Here",
        content:
          "Life-Therapy is an online personal development and coaching platform founded by Roxanne Bouwer, a qualified life coach, counsellor, and NLP practitioner. We help people build unshakeable confidence, manage anxiety and stress, strengthen relationships, and create lives they love.\n\nWhether you prefer the personalised guidance of 1:1 sessions or the flexibility of learning at your own pace through our online course library, we meet you where you are — and walk with you toward where you want to be.\n\nAll our services are delivered online, making expert support accessible whether you're in South Africa or anywhere in the world.",
        sortOrder: 1,
      },
      {
        pageId: homePage.id,
        sectionType: "image_text",
        title: "The Life-Therapy Framework",
        content:
          "Our coaching framework is built around six key phases — from identifying your concerns and assessing your current situation, through reframing your mindset and implementing new habits, to reinforcing new skills and reviewing your personal development.\n\nAt the centre of it all: building a meaningful and confident life through self-awareness, personal growth, self-knowledge, purpose, confidence, and success.",
        imageUrl: "/images/framework.jpg",
        config: { imagePosition: "right", background: "muted" },
        sortOrder: 2,
      },
      {
        pageId: homePage.id,
        sectionType: "features",
        title: "Three Ways to Work With Us",
        config: {
          items: [
            {
              icon: "Video",
              title: "1:1 Online Sessions",
              description:
                "Personalised coaching and counselling with Roxanne via secure video call. Work through your unique challenges with expert guidance tailored to your needs.",
              link: "/sessions",
              linkText: "Learn More & Book",
            },
            {
              icon: "BookOpen",
              title: "Self-Paced Online Courses",
              description:
                "10 comprehensive courses covering self-esteem, confidence, anxiety, relationships, and more. Video lessons, downloadable worksheets, and practical exercises you complete at your own pace.",
              link: "/courses",
              linkText: "Browse Courses",
            },
            {
              icon: "Package",
              title: "Bundles & Packages",
              description:
                "Get more value with curated course bundles or combine self-paced learning with 1:1 sessions for the ultimate growth experience.",
              link: "/packages",
              linkText: "View Packages",
            },
          ],
        },
        sortOrder: 3,
      },
      {
        pageId: homePage.id,
        sectionType: "course_grid",
        title: "Course Library Preview",
        subtitle: "Expert-designed courses for your personal growth journey",
        config: { featuredOnly: true, maxCount: 6 },
        sortOrder: 4,
      },
      {
        pageId: homePage.id,
        sectionType: "image_text",
        title: "Meet Your Coach",
        content:
          "Hi, I'm Roxanne Bouwer — a qualified life coach, counsellor, and NLP practitioner. I've spent years creating practical frameworks that help people heal past wounds, build confidence, and step into a more meaningful life. Whether through our 1:1 sessions or our online course library, my mission is the same: to help you uncover the strength and confidence you already have inside.",
        imageUrl: "/images/roxanne-full.jpg",
        ctaText: "Read My Story",
        ctaLink: "/about",
        config: { imagePosition: "left" },
        sortOrder: 5,
      },
      {
        pageId: homePage.id,
        sectionType: "testimonial_carousel",
        title: "What Our Clients Say",
        config: { count: 6 },
        sortOrder: 6,
      },
      {
        pageId: homePage.id,
        sectionType: "cta",
        title: "Ready to Start Your Journey?",
        subtitle:
          "Join thousands of people on their growth journey. Take the first step today.",
        ctaText: "Book a Free Consultation",
        ctaLink: "/book",
        sortOrder: 7,
      },
    ],
  });

  // ── About Page Sections ──────────────────────────────────
  const aboutPage = pages[1];
  await prisma.pageSection.deleteMany({ where: { pageId: aboutPage.id } });
  await prisma.pageSection.createMany({
    data: [
      {
        pageId: aboutPage.id,
        sectionType: "hero",
        title: "About Roxanne",
        subtitle: "Qualified life coach, counsellor, and NLP practitioner — empowering people to build confidence and create meaningful change.",
        imageUrl: "/images/hero-about-lotus.jpg",
        sortOrder: 0,
      },
      {
        pageId: aboutPage.id,
        sectionType: "text",
        title: "The Lotus Story",
        content:
          "Our story begins with the lotus — one of the most beautiful flowers in the world. Considered sacred in some cultures, the lotus is a symbol of purity, enlightenment, self-regeneration, and rebirth.\n\nThis elegant flower, contrary to its outer beauty, only grows in murky waters. Once it's ready to bloom, it emerges from the depths and opens in the early hours of the morning. Each sunset, the flower closes and submerges itself to rejuvenate — and rises again at sunrise. Reborn every morning.\n\nJust like the lotus, we all experience our own murky waters. But regardless of the challenges we face, we can emerge stronger and ready to create a more meaningful life.\n\n\"If we are to grow stronger and wiser every day, we must have the intention to grow as the lotus and rise brighter every day.\" — Roxanne Bouwer",
        sortOrder: 1,
      },
      {
        pageId: aboutPage.id,
        sectionType: "image_text",
        title: "Meet Roxanne",
        content:
          "I'm Roxanne Bouwer, the founder of Life-Therapy. As a qualified life coach, counsellor, and NLP practitioner, I've spent years developing practical, evidence-based approaches that help people transform their lives from the inside out.\n\nMy work is rooted in a simple belief: you already have the confidence and strength you need — sometimes you just need guidance to find it. I've worked with teens navigating the complexities of growing up, adults rebuilding their self-worth, couples reconnecting after drifting apart, and professionals stepping into leadership with authenticity.\n\nThrough Life-Therapy, I've built two ways to support you on that journey. Our 1:1 online sessions offer personalised, in-depth coaching and counselling via secure video call. And our online course library — 10 comprehensive courses covering everything from self-esteem and confidence to anxiety management, relationships, and professional presence — lets you learn and grow at your own pace, on your own schedule.",
        imageUrl: "/images/roxanne-portrait.jpg",
        config: { imagePosition: "right" },
        sortOrder: 2,
      },
      {
        pageId: aboutPage.id,
        sectionType: "features",
        title: "Qualifications & Approach",
        config: {
          items: [
            { icon: "Award", title: "Qualified Psychology Counsellor", description: "" },
            { icon: "Award", title: "Certified NLP Life Coach", description: "" },
            { icon: "Brain", title: "Evidence-based methodologies", description: "Including CBT, mindfulness, and self-compassion practices" },
            { icon: "Globe", title: "International reach", description: "Clients in South Africa, United Kingdom, Canada, and beyond" },
            { icon: "BookOpen", title: "10 self-paced online courses", description: "82+ modules, 62+ hours of content" },
          ],
        },
        sortOrder: 3,
      },
      {
        pageId: aboutPage.id,
        sectionType: "testimonial_carousel",
        title: "What Our Clients Say",
        config: { count: 4 },
        sortOrder: 4,
      },
    ],
  });

  // ── Sessions Page Sections ──────────────────────────────
  const sessionsPage = pages[2];
  await prisma.pageSection.deleteMany({ where: { pageId: sessionsPage.id } });
  await prisma.pageSection.createMany({
    data: [
      {
        pageId: sessionsPage.id,
        sectionType: "hero",
        title: "1:1 Online Sessions",
        subtitle: "Personalised coaching and counselling with Roxanne via secure video call. Work through your unique challenges with expert guidance tailored specifically to your needs.",
        imageUrl: "/images/hero-sessions.jpg",
        ctaText: "Book a Free Consultation",
        ctaLink: "/book",
        config: { ctaSecondaryText: "View Packages", ctaSecondaryLink: "/packages" },
        sortOrder: 0,
      },
      {
        pageId: sessionsPage.id,
        sectionType: "features",
        title: "How I Can Help",
        config: {
          items: [
            { icon: "Brain", title: "Life Coaching", description: "Goal setting, confidence building, and personal growth strategies tailored to your unique situation." },
            { icon: "Heart", title: "Counselling", description: "A safe, non-judgemental space to work through emotional challenges, grief, anxiety, and stress." },
            { icon: "Users", title: "Couples Therapy", description: "Rebuild connection, improve communication, and navigate relationship challenges together." },
            { icon: "Sparkles", title: "NLP Coaching", description: "Neuro-Linguistic Programming techniques to reframe thought patterns and break through limiting beliefs." },
            { icon: "Shield", title: "Teen Coaching", description: "Age-appropriate coaching for teenagers dealing with self-esteem, peer pressure, and identity." },
            { icon: "Users", title: "Family Counselling", description: "Navigate family dynamics, improve relationships, and create a more supportive home environment." },
          ],
        },
        sortOrder: 1,
      },
      {
        pageId: sessionsPage.id,
        sectionType: "steps",
        title: "How It Works",
        config: {
          items: [
            { title: "Book a Consultation", description: "Schedule a free 30-minute consultation to discuss your needs and see if we're a good fit." },
            { title: "Choose Your Path", description: "Select individual sessions or a package that suits your goals and budget." },
            { title: "Start Growing", description: "Meet via secure video call and begin your journey toward meaningful change." },
          ],
        },
        sortOrder: 2,
      },
      {
        pageId: sessionsPage.id,
        sectionType: "pricing",
        title: "Session Pricing",
        config: {
          items: [
            { icon: "Sparkles", title: "Free Consultation", description: "30-minute introductory call", price: "Free", priceNote: "no obligation", ctaText: "Book a Consultation", ctaLink: "/book", highlight: true },
            { icon: "Video", title: "Individual Session", description: "60-minute 1:1 video call", price: "R850", priceNote: "per session", ctaText: "Book a Session", ctaLink: "/book" },
            { icon: "Users", title: "Couples Session", description: "60-minute couples video call", price: "R1,200", priceNote: "per session", ctaText: "Book a Session", ctaLink: "/book" },
          ],
          footnote: "Save more with session packages. <a href='/packages'>View Packages →</a>",
        },
        sortOrder: 3,
      },
      {
        pageId: sessionsPage.id,
        sectionType: "cta",
        title: "Ready to Take the First Step?",
        subtitle: "Book a free consultation and let's discuss how I can support your journey.",
        ctaText: "Book Your Free Consultation",
        ctaLink: "/book",
        sortOrder: 4,
      },
    ],
  });

  // ── Courses Page Sections ──────────────────────────────
  const coursesPage = pages[3];
  await prisma.pageSection.deleteMany({ where: { pageId: coursesPage.id } });
  await prisma.pageSection.createMany({
    data: [
      {
        pageId: coursesPage.id,
        sectionType: "hero",
        title: "Online Courses",
        subtitle: "Expert-designed, self-paced courses to help you build confidence, manage stress, strengthen relationships, and create meaningful change.",
        imageUrl: "/images/hero-courses.jpg",
        sortOrder: 0,
      },
      {
        pageId: coursesPage.id,
        sectionType: "course_catalog",
        sortOrder: 1,
      },
    ],
  });

  // ── Packages Page Sections ─────────────────────────────
  const packagesPage = pages[4];
  await prisma.pageSection.deleteMany({ where: { pageId: packagesPage.id } });
  await prisma.pageSection.createMany({
    data: [
      {
        pageId: packagesPage.id,
        sectionType: "hero",
        title: "Bundles & Packages",
        subtitle: "Get more value with curated course bundles designed for your specific growth journey. Save up to 30% compared to purchasing courses individually.",
        imageUrl: "/images/hero-packages.jpg",
        sortOrder: 0,
      },
      {
        pageId: packagesPage.id,
        sectionType: "bundle_grid",
        sortOrder: 1,
      },
      {
        pageId: packagesPage.id,
        sectionType: "cta",
        title: "Not Sure Which Bundle Is Right for You?",
        subtitle: "Book a free consultation and I'll help you find the perfect combination for your goals.",
        ctaText: "Book a Free Consultation",
        ctaLink: "/book",
        sortOrder: 2,
      },
    ],
  });

  // ── Book Page Sections ─────────────────────────────────
  const bookPage = pages[5];
  await prisma.pageSection.deleteMany({ where: { pageId: bookPage.id } });
  await prisma.pageSection.createMany({
    data: [
      {
        pageId: bookPage.id,
        sectionType: "hero",
        title: "Book a Session",
        subtitle: "Ready to start your journey? Book a free 30-minute consultation or schedule your first session below.",
        imageUrl: "/images/hero-book.jpg",
        sortOrder: 0,
      },
      {
        pageId: bookPage.id,
        sectionType: "pricing",
        title: "Booking Options",
        config: {
          items: [
            { icon: "MessageCircle", title: "Free Consultation", description: "A no-obligation 30-minute call to discuss your needs, ask questions, and see if we're a good fit.", price: "Free", ctaText: "Book via WhatsApp", ctaLink: "https://wa.me/27710170353?text=Hi%20Roxanne%2C%20I%27d%20like%20to%20book%20a%20free%20consultation.", highlight: true },
            { icon: "Calendar", title: "1:1 Session", description: "A full 60-minute coaching or counselling session tailored to your specific needs and goals.", price: "R850", priceNote: "per session", ctaText: "Book via WhatsApp", ctaLink: "https://wa.me/27710170353?text=Hi%20Roxanne%2C%20I%27d%20like%20to%20book%20a%20session." },
            { icon: "Users", title: "Couples Session", description: "A 60-minute couples coaching or counselling session to strengthen your relationship together.", price: "R1,200", priceNote: "per session", ctaText: "Book via WhatsApp", ctaLink: "https://wa.me/27710170353?text=Hi%20Roxanne%2C%20I%27d%20like%20to%20book%20a%20couples%20session." },
          ],
        },
        sortOrder: 1,
      },
      {
        pageId: bookPage.id,
        sectionType: "steps",
        title: "How Booking Works",
        config: {
          items: [
            { title: "Send a Message", description: "Send a WhatsApp message or email to book your preferred time slot." },
            { title: "Get Confirmation", description: "Receive a confirmation with your Microsoft Teams meeting link." },
            { title: "Join the Call", description: "Join the call at your scheduled time — no downloads needed." },
          ],
        },
        sortOrder: 2,
      },
      {
        pageId: bookPage.id,
        sectionType: "faq",
        title: "Common Questions",
        config: {
          items: [
            { question: "What happens in the free consultation?", answer: "We'll chat about what you're going through, what you'd like to achieve, and I'll explain how our sessions or courses can help. There's absolutely no pressure or obligation." },
            { question: "Do I need to prepare anything?", answer: "No preparation needed. Just come as you are. If you have specific questions or goals in mind, feel free to share them." },
            { question: "I'm in a different time zone — can we still work together?", answer: "Absolutely! I work with clients across South Africa, the UK, Canada, and beyond. We'll find a time that works for both of us." },
            { question: "Is everything confidential?", answer: "100%. Everything discussed in our sessions is completely confidential. Your privacy and trust are paramount." },
            { question: "What's the difference between coaching and counselling?", answer: "Coaching is future-focused — we work on goals, confidence, and personal growth. Counselling helps you process emotions, past experiences, and mental health challenges. Many clients benefit from a blend of both, and I tailor each session to what you need most." },
            { question: "How many sessions will I need?", answer: "It depends on your goals. Some clients see meaningful progress in 4–6 sessions, while others prefer ongoing support over several months. We'll discuss a recommended approach during your free consultation — there's never any pressure to commit to more than you need." },
            { question: "Should I do a course or book 1:1 sessions?", answer: "Our self-paced courses are great for structured learning at your own speed. 1:1 sessions offer personalised guidance for your specific situation. Many clients combine both — a course for foundational skills and sessions for deeper, tailored support." },
            { question: "What is your cancellation policy?", answer: "We understand that life happens. Please give at least 24 hours' notice if you need to reschedule. Late cancellations or no-shows may be charged at full rate. We're always happy to find an alternative time that works for you." },
            { question: "Do you offer couples or family sessions?", answer: "Yes! Couples sessions are available at R1,200 per 60-minute session. Family counselling is also offered — we'll discuss the best format and approach during your free consultation." },
          ],
        },
        sortOrder: 3,
      },
      {
        pageId: bookPage.id,
        sectionType: "cta",
        title: "Still Have Questions?",
        subtitle: "Reach out anytime — I'm here to help.",
        ctaText: "WhatsApp Us",
        ctaLink: "https://wa.me/27710170353",
        sortOrder: 4,
      },
    ],
  });

  // ── Contact Page Sections ──────────────────────────────
  const contactPage = pages[6];
  await prisma.pageSection.deleteMany({ where: { pageId: contactPage.id } });
  await prisma.pageSection.createMany({
    data: [
      {
        pageId: contactPage.id,
        sectionType: "hero",
        title: "Get in Touch",
        subtitle: "Have a question about our courses or sessions? Want to learn more about how Life-Therapy can support your journey? We'd love to hear from you.",
        imageUrl: "/images/hero-contact.jpg",
        sortOrder: 0,
      },
      {
        pageId: contactPage.id,
        sectionType: "features",
        title: "Contact Details",
        config: {
          items: [
            { icon: "Mail", title: "Email", description: "hello@life-therapy.co.za — We respond within 24 hours" },
            { icon: "Phone", title: "WhatsApp", description: "+27 71 017 0353 — Quick questions & booking" },
            { icon: "Clock", title: "Hours", description: "Mon – Fri: 9:00 am – 5:00 pm (SAST) — Session times flexible for international clients" },
            { icon: "MapPin", title: "Location", description: "100% Online — South Africa based, sessions via Microsoft Teams globally" },
          ],
        },
        sortOrder: 1,
      },
      {
        pageId: contactPage.id,
        sectionType: "cta",
        title: "Prefer to Chat in Person?",
        subtitle: "Book a free 30-minute consultation and let's discuss how I can help.",
        ctaText: "Book a Free Consultation",
        ctaLink: "/book",
        sortOrder: 2,
      },
    ],
  });

  // ── Courses ──────────────────────────────────────────────
  const coursesData = [
    {
      title: "Foundations of Self-Esteem",
      slug: "foundations-of-self-esteem",
      subtitle: "Build your self-worth from the ground up",
      shortDescription: "The starting point for everyone wanting to build genuine self-worth.",
      description: "Build your self-worth from the ground up. This foundational course walks you through understanding self-esteem, challenging negative self-talk, setting goals, building assertiveness, cultivating resilience, and creating lasting change.",
      price: 38900,
      category: "self_esteem",
      modulesCount: 9,
      hours: "~6 Hours",
      level: "Beginner",
      isPublished: true,
      isFeatured: true,
      sortOrder: 0,
    },
    {
      title: "Confidence from Within",
      slug: "confidence-from-within",
      subtitle: "Silence your inner critic & build self-belief",
      shortDescription: "Silence your inner critic, end self-sabotage, and build authentic confidence.",
      description: "Go beyond surface-level confidence. Learn to silence your inner critic, overcome self-sabotage, and build authentic, lasting confidence that comes from within.",
      price: 38900,
      category: "self_esteem",
      modulesCount: 10,
      hours: "~7.5 Hours",
      level: "Beginner",
      isPublished: true,
      isFeatured: true,
      sortOrder: 1,
    },
    {
      title: "Quit Your Imposter Syndrome",
      slug: "quit-your-imposter-syndrome",
      subtitle: "Own your achievements and stop feeling like a fraud",
      shortDescription: "Own your achievements and stop feeling like a fraud.",
      description: "Learn to recognise imposter patterns, reframe your thinking, own your achievements, and step into your success with confidence.",
      price: 38900,
      category: "self_esteem",
      modulesCount: 8,
      hours: "~6 Hours",
      level: "Intermediate",
      isPublished: true,
      isFeatured: false,
      sortOrder: 2,
    },
    {
      title: "Stress to Strength",
      slug: "stress-to-strength",
      subtitle: "Your guide to anxiety management & resilience",
      shortDescription: "Manage anxiety, regulate your nervous system, and build resilience.",
      description: "A comprehensive guide to managing anxiety, regulating your nervous system, building resilience, and transforming stress into a source of strength.",
      price: 38900,
      category: "mental_wellness",
      modulesCount: 10,
      hours: "~7.5 Hours",
      level: "Beginner",
      isPublished: true,
      isFeatured: true,
      sortOrder: 3,
    },
    {
      title: "The People-Pleasing Cure",
      slug: "the-people-pleasing-cure",
      subtitle: "Set boundaries without guilt",
      shortDescription: "Set boundaries without guilt and stop putting everyone else first.",
      description: "Break free from people-pleasing patterns. Learn to set healthy boundaries, say no without guilt, and prioritise your own needs while maintaining meaningful relationships.",
      price: 38900,
      category: "mental_wellness",
      modulesCount: 8,
      hours: "~6 Hours",
      level: "Beginner",
      isPublished: true,
      isFeatured: true,
      sortOrder: 4,
    },
    {
      title: "The Empowered Empath",
      slug: "the-empowered-empath",
      subtitle: "Transform sensitivity into your greatest strength",
      shortDescription: "Transform sensitivity into your greatest strength.",
      description: "Discover how to harness your sensitivity as a superpower. Learn energy management, emotional regulation, and how to thrive as a highly sensitive person.",
      price: 38900,
      category: "mental_wellness",
      modulesCount: 8,
      hours: "~6 Hours",
      level: "Beginner",
      isPublished: true,
      isFeatured: false,
      sortOrder: 5,
    },
    {
      title: "Love Reset",
      slug: "love-reset",
      subtitle: "Rekindle connection & rediscover your partner",
      shortDescription: "Rekindle connection and rediscover your partner. Includes New Parents add-on.",
      description: "Whether you want to strengthen an already good relationship or rebuild after drifting apart, this course guides couples through communication, trust, intimacy, and reconnection. Includes a bonus New Parents module.",
      price: 38900,
      category: "relationships",
      modulesCount: 11,
      hours: "~8 Hours",
      level: "Beginner",
      isPublished: true,
      isFeatured: true,
      sortOrder: 6,
    },
    {
      title: "Thriving Through Teen Years",
      slug: "thriving-through-teen-years",
      subtitle: "A young person's guide to confidence",
      shortDescription: "A young person's guide to confidence and wellbeing.",
      description: "Designed for teenagers (13-18), this course helps young people build self-confidence, manage anxiety, navigate peer pressure, and develop healthy self-image.",
      price: 38900,
      category: "specialised",
      modulesCount: 8,
      hours: "~6 Hours",
      level: "Beginner",
      isPublished: true,
      isFeatured: false,
      sortOrder: 7,
    },
    {
      title: "Executive Presence",
      slug: "executive-presence",
      subtitle: "Lead with confidence, negotiate your worth",
      shortDescription: "Lead with confidence, negotiate your worth, command the room.",
      description: "Develop the executive presence that sets leaders apart. Build authentic authority, master high-stakes communication, negotiate your worth, and lead with confidence.",
      price: 38900,
      category: "specialised",
      modulesCount: 8,
      hours: "~6 Hours",
      level: "Intermediate",
      isPublished: true,
      isFeatured: false,
      sortOrder: 8,
    },
    {
      title: "Body Neutral",
      slug: "body-neutral",
      subtitle: "Make peace with your body and reclaim your confidence",
      shortDescription: "Make peace with your body and reclaim your confidence.",
      description: "Move beyond body positivity to body neutrality. Learn to detach your self-worth from appearance, develop a healthier relationship with your body, and reclaim your confidence.",
      price: 38900,
      category: "specialised",
      modulesCount: 8,
      hours: "~6 Hours",
      level: "Beginner",
      isPublished: true,
      isFeatured: false,
      sortOrder: 9,
    },
  ];

  for (const course of coursesData) {
    await prisma.course.upsert({
      where: { slug: course.slug },
      update: {},
      create: course,
    });
  }

  // ── Bundles ──────────────────────────────────────────────
  const allCourses = await prisma.course.findMany();
  const courseBySlug = (slug: string) => allCourses.find((c) => c.slug === slug)!;

  const bundlesData = [
    {
      title: "The Complete Confidence Journey",
      slug: "complete-confidence-journey",
      description: "Comprehensive confidence transformation from the ground up. Includes Foundations of Self-Esteem, Confidence from Within, and Quit Your Imposter Syndrome.",
      bestFor: "Anyone wanting comprehensive confidence transformation from the ground up",
      price: 89900,
      courses: ["foundations-of-self-esteem", "confidence-from-within", "quit-your-imposter-syndrome"],
    },
    {
      title: "The Sensitive Soul",
      slug: "the-sensitive-soul",
      description: "Self-worth, energy management, and boundary skills for highly sensitive people. Includes Foundations of Self-Esteem, The Empowered Empath, and The People-Pleasing Cure.",
      bestFor: "Highly sensitive people who need self-worth, energy management, and boundary skills",
      price: 89900,
      courses: ["foundations-of-self-esteem", "the-empowered-empath", "the-people-pleasing-cure"],
    },
    {
      title: "Mental Wellness Complete",
      slug: "mental-wellness-complete",
      description: "For anyone dealing with anxiety, overwhelm, and difficulty setting limits. Includes Stress to Strength and The People-Pleasing Cure.",
      bestFor: "Anyone dealing with anxiety, overwhelm, and difficulty setting limits",
      price: 64900,
      courses: ["stress-to-strength", "the-people-pleasing-cure"],
    },
    {
      title: "The Career Accelerator",
      slug: "the-career-accelerator",
      description: "For professionals wanting to advance with confidence. Includes Quit Your Imposter Syndrome and Executive Presence.",
      bestFor: "Professionals wanting to advance with confidence",
      price: 64900,
      courses: ["quit-your-imposter-syndrome", "executive-presence"],
    },
    {
      title: "Relationship & Family",
      slug: "relationship-and-family",
      description: "Strengthen all family relationships. Includes Love Reset (with New Parents Add-On) and Thriving Through Teen Years.",
      bestFor: "Families wanting to strengthen all relationships",
      price: 64900,
      courses: ["love-reset", "thriving-through-teen-years"],
    },
  ];

  for (const bundleData of bundlesData) {
    const { courses: courseSlugs, ...bundleFields } = bundleData;
    const bundle = await prisma.bundle.upsert({
      where: { slug: bundleFields.slug },
      update: {},
      create: { ...bundleFields, isPublished: true },
    });

    // Link courses to bundle
    for (let i = 0; i < courseSlugs.length; i++) {
      const course = courseBySlug(courseSlugs[i]);
      if (course) {
        await prisma.bundleCourse.upsert({
          where: {
            bundleId_courseId: { bundleId: bundle.id, courseId: course.id },
          },
          update: {},
          create: { bundleId: bundle.id, courseId: course.id, sortOrder: i },
        });
      }
    }
  }

  // ── Testimonials ─────────────────────────────────────────
  const testimonialsData = [
    {
      name: "Sarah M.",
      role: "1:1 Client",
      location: "Cape Town, South Africa",
      content: "Working with Roxanne has been transformative. She helped me see patterns I couldn't see on my own and gave me practical tools to build real confidence. I finally feel like I'm living authentically.",
      rating: 5,
      serviceType: "session",
      isPublished: true,
      isFeatured: true,
      sortOrder: 0,
    },
    {
      name: "James K.",
      role: "Course Student",
      location: "London, United Kingdom",
      content: "The Confidence from Within course was exactly what I needed. The video lessons were engaging, the worksheets made me really think, and I can honestly say I handle self-doubt completely differently now.",
      rating: 5,
      serviceType: "course",
      isPublished: true,
      isFeatured: true,
      sortOrder: 1,
    },
    {
      name: "Priya D.",
      role: "1:1 Client",
      location: "Toronto, Canada",
      content: "Roxanne's approach is warm, professional, and incredibly effective. As someone dealing with imposter syndrome in a demanding career, her guidance helped me own my achievements and stop second-guessing myself.",
      rating: 5,
      serviceType: "session",
      isPublished: true,
      isFeatured: true,
      sortOrder: 2,
    },
    {
      name: "Liam T.",
      role: "Course Student",
      location: "Johannesburg, South Africa",
      content: "I completed the Stress to Strength course during a really tough time. The modules on nervous system regulation were a game-changer. Highly recommend to anyone feeling overwhelmed.",
      rating: 5,
      serviceType: "course",
      isPublished: true,
      isFeatured: true,
      sortOrder: 3,
    },
  ];

  for (const testimonial of testimonialsData) {
    await prisma.testimonial.create({ data: testimonial });
  }

  // ── Site Settings ──────────────────────────────────────────
  const existingSettings = await prisma.siteSetting.findFirst();
  if (existingSettings) {
    console.log("  Site settings: already exists, skipped");
  } else {
    await prisma.siteSetting.create({
      data: {
        siteName: "Life-Therapy",
        tagline: "Online life coaching, counselling, and self-paced courses. Empowering you to build confidence and create meaningful change.",
        email: "hello@life-therapy.co.za",
        phone: "+27 71 017 0353",
        whatsappNumber: "27710170353",
        businessHours: {
          monday: { open: "09:00", close: "17:00", closed: false },
          tuesday: { open: "09:00", close: "17:00", closed: false },
          wednesday: { open: "09:00", close: "17:00", closed: false },
          thursday: { open: "09:00", close: "17:00", closed: false },
          friday: { open: "09:00", close: "17:00", closed: false },
          saturday: { open: "09:00", close: "13:00", closed: true },
          sunday: { open: "09:00", close: "13:00", closed: true },
        },
        locationText: "100% Online — South Africa based, sessions via Microsoft Teams globally",
        facebookUrl: "https://facebook.com/lifetherapyza",
        linkedinUrl: "https://linkedin.com/in/roxanne-bouwer-03551820a",
        copyrightText: "\u00a92026 All rights reserved by Life Therapy PTY Ltd. Reg nr: 2019/570691/07.",
        footerTagline: "Online life coaching, counselling, and self-paced courses. Empowering you to build confidence and create meaningful change.",
        // Booking defaults
        bookingMaxAdvanceDays: 30,
        bookingMinNoticeHours: 24,
        bookingBufferMinutes: 15,
        bookingEnabled: false,
      },
    });
    console.log("  Site settings: created");
  }

  // ── Fix admin user roles (enum migration resets to default) ──
  await prisma.adminUser.updateMany({
    where: {},
    data: { role: "super_admin" },
  });

  console.log("Seed complete!");
  console.log(`  Pages: ${pages.length}`);
  console.log(`  Courses: ${coursesData.length}`);
  console.log(`  Bundles: ${bundlesData.length}`);
  console.log(`  Testimonials: ${testimonialsData.length}`);
  console.log("\nNote: Create an admin user in Supabase Auth, then run:");
  console.log('  INSERT INTO admin_users (id, "supabaseUserId", email, name, role)');
  console.log("  VALUES (gen_random_uuid(), '<supabase-user-id>', '<email>', '<name>', 'super_admin');");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
