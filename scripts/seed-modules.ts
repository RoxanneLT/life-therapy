/**
 * Seed all modules for all 10 courses.
 * Each module is also published as a standalone short course.
 *
 * Run with:
 *   npx dotenvx run --env-file=.env.local -- npx tsx scripts/seed-modules.ts
 */

import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface ModuleSeed {
  title: string;
  description: string;
  standaloneSlug: string;
  standaloneTitle: string;
  standaloneDescription: string;
}

// Standalone price for individual modules (ZAR cents)
const MODULE_PRICE = 6900; // R69

// ── Course slug → category mapping ──
const courseCategories: Record<string, string> = {
  "foundations-of-self-esteem": "self_esteem",
  "confidence-from-within": "self_esteem",
  "quit-your-imposter-syndrome": "self_esteem",
  "stress-to-strength": "mental_wellness",
  "the-people-pleasing-cure": "mental_wellness",
  "the-empowered-empath": "mental_wellness",
  "love-reset": "relationships",
  "thriving-through-teen-years": "specialised",
  "executive-presence": "specialised",
  "body-neutral": "specialised",
};

// ── All modules per course ──
const courseModules: Record<string, ModuleSeed[]> = {
  "foundations-of-self-esteem": [
    {
      title: "Understanding Self-Esteem",
      standaloneSlug: "understanding-self-esteem",
      standaloneTitle: "Understanding Self-Esteem",
      description: "Explore what self-esteem really is, where it comes from, and how it shapes your daily life.",
      standaloneDescription: "Explore what self-esteem really is, where it comes from, and how it shapes your daily life. The essential starting point for building genuine self-worth.",
    },
    {
      title: "Challenging Negative Self-Talk",
      standaloneSlug: "challenging-negative-self-talk",
      standaloneTitle: "Challenging Negative Self-Talk",
      description: "Identify and reframe the critical inner voice that undermines your confidence.",
      standaloneDescription: "Learn to identify, challenge, and reframe the critical inner voice that undermines your confidence and keeps you stuck in self-doubt.",
    },
    {
      title: "Setting Goals & Celebrating Success",
      standaloneSlug: "setting-goals-celebrating-success",
      standaloneTitle: "Setting Goals & Celebrating Success",
      description: "Set meaningful goals and build the habit of acknowledging your progress.",
      standaloneDescription: "Learn to set meaningful, achievable goals and build the life-changing habit of acknowledging and celebrating your progress along the way.",
    },
    {
      title: "Assertiveness & Boundary Setting",
      standaloneSlug: "assertiveness-boundary-setting",
      standaloneTitle: "Assertiveness & Boundary Setting",
      description: "Develop assertive communication skills and learn to set healthy boundaries.",
      standaloneDescription: "Develop assertive communication skills and learn to set healthy boundaries that protect your energy and strengthen your relationships.",
    },
    {
      title: "Cultivating Resilience",
      standaloneSlug: "cultivating-resilience",
      standaloneTitle: "Cultivating Resilience",
      description: "Build inner strength and the ability to bounce back from setbacks.",
      standaloneDescription: "Build inner strength and develop the mental toolkit to bounce back from setbacks stronger than before.",
    },
    {
      title: "Embracing Imperfection",
      standaloneSlug: "embracing-imperfection",
      standaloneTitle: "Embracing Imperfection",
      description: "Let go of perfectionism and learn to accept yourself as you are.",
      standaloneDescription: "Let go of perfectionism, silence the 'not good enough' voice, and learn to accept and value yourself exactly as you are.",
    },
    {
      title: "Building Support Networks",
      standaloneSlug: "building-support-networks",
      standaloneTitle: "Building Support Networks",
      description: "Create and strengthen the relationships that support your growth.",
      standaloneDescription: "Learn to identify, create, and strengthen the relationships and support systems that fuel your personal growth journey.",
    },
    {
      title: "Reflection & Integration",
      standaloneSlug: "se-reflection-integration",
      standaloneTitle: "Reflection & Integration",
      description: "Consolidate your learning and integrate new self-esteem skills into daily life.",
      standaloneDescription: "Consolidate everything you've learned and create a sustainable plan to integrate your new self-esteem skills into everyday life.",
    },
    {
      title: "Conclusion & Next Steps",
      standaloneSlug: "se-conclusion-next-steps",
      standaloneTitle: "Conclusion & Next Steps",
      description: "Review your journey and plan your continued growth beyond the course.",
      standaloneDescription: "Review your transformation journey, celebrate your progress, and create a clear roadmap for continued growth beyond the course.",
    },
  ],

  "confidence-from-within": [
    {
      title: "True vs False Confidence",
      standaloneSlug: "true-vs-false-confidence",
      standaloneTitle: "True vs False Confidence",
      description: "Understand the difference between authentic confidence and performed confidence.",
      standaloneDescription: "Discover the crucial difference between authentic confidence that lasts and performed confidence that crumbles under pressure.",
    },
    {
      title: "Meeting Your Inner Critic",
      standaloneSlug: "meeting-your-inner-critic",
      standaloneTitle: "Meeting Your Inner Critic",
      description: "Get to know your inner critic and understand why it exists.",
      standaloneDescription: "Get to know your inner critic — understand why it exists, what triggers it, and how to start changing your relationship with it.",
    },
    {
      title: "The 5 Types of Self-Sabotage",
      standaloneSlug: "5-types-of-self-sabotage",
      standaloneTitle: "The 5 Types of Self-Sabotage",
      description: "Identify which self-sabotage patterns — Procrastinator, Perfectionist, People-Pleaser, Avoider, or Self-Doubter — are holding you back.",
      standaloneDescription: "Discover which of the 5 self-sabotage types — The Procrastinator, Perfectionist, People-Pleaser, Avoider, or Self-Doubter — are secretly running your life.",
    },
    {
      title: "From Critic to Coach",
      standaloneSlug: "from-critic-to-coach",
      standaloneTitle: "From Critic to Coach",
      description: "Transform your inner critic into a supportive inner coach.",
      standaloneDescription: "Learn powerful techniques to transform your harsh inner critic into a supportive inner coach that builds you up instead of tearing you down.",
    },
    {
      title: "Values-Based Confidence",
      standaloneSlug: "values-based-confidence",
      standaloneTitle: "Values-Based Confidence",
      description: "Build unshakeable confidence rooted in your core values.",
      standaloneDescription: "Build unshakeable confidence by aligning your actions with your core values — confidence that doesn't depend on external validation.",
    },
    {
      title: "Building Self-Trust",
      standaloneSlug: "building-self-trust",
      standaloneTitle: "Building Self-Trust",
      description: "Develop trust in yourself, your decisions, and your abilities.",
      standaloneDescription: "Develop deep trust in yourself, your decisions, and your abilities. Stop second-guessing and start believing in your own judgement.",
    },
    {
      title: "Body Confidence from Within",
      standaloneSlug: "body-confidence-from-within",
      standaloneTitle: "Body Confidence from Within",
      description: "Build a healthier relationship with your body through inner confidence.",
      standaloneDescription: "Build a healthier, more compassionate relationship with your body — confidence that comes from within, not from the mirror.",
    },
    {
      title: "Social Confidence Essentials",
      standaloneSlug: "social-confidence-essentials",
      standaloneTitle: "Social Confidence Essentials",
      description: "Navigate social situations with ease and authenticity.",
      standaloneDescription: "Master the art of navigating social situations with ease, authenticity, and genuine confidence — from small talk to meaningful connection.",
    },
    {
      title: "Confidence Under Pressure",
      standaloneSlug: "confidence-under-pressure",
      standaloneTitle: "Confidence Under Pressure",
      description: "Maintain your confidence when stakes are high and pressure is on.",
      standaloneDescription: "Learn to maintain and project confidence when the stakes are high — presentations, interviews, difficult conversations, and beyond.",
    },
    {
      title: "Living Confidently",
      standaloneSlug: "living-confidently",
      standaloneTitle: "Living Confidently",
      description: "Integrate confident thinking and behaviour into every area of your life.",
      standaloneDescription: "Bring together everything you've learned and create a sustainable lifestyle of authentic confidence in every area of your life.",
    },
  ],

  "quit-your-imposter-syndrome": [
    {
      title: "Understanding Imposter Syndrome",
      standaloneSlug: "understanding-imposter-syndrome",
      standaloneTitle: "Understanding Imposter Syndrome",
      description: "Learn what imposter syndrome is, how common it is, and how the imposter cycle works.",
      standaloneDescription: "Discover what imposter syndrome really is, why it affects high-achievers most, and how to recognise the imposter cycle in your own life.",
    },
    {
      title: "The 5 Imposter Types",
      standaloneSlug: "the-5-imposter-types",
      standaloneTitle: "The 5 Imposter Types",
      description: "Identify your imposter type — The Perfectionist, Expert, Natural Genius, Soloist, or Superhero.",
      standaloneDescription: "Discover which of the 5 imposter types — Perfectionist, Expert, Natural Genius, Soloist, or Superhero — drives your self-doubt, and learn targeted strategies.",
    },
    {
      title: "Origins of Achievement Doubt",
      standaloneSlug: "origins-of-achievement-doubt",
      standaloneTitle: "Origins of Achievement Doubt",
      description: "Understand the family, cultural, and societal roots of your imposter feelings.",
      standaloneDescription: "Trace your imposter feelings back to their roots — family dynamics, early experiences, and cultural messages — to finally understand why you doubt yourself.",
    },
    {
      title: "Rewriting the Internal Narrative",
      standaloneSlug: "rewriting-internal-narrative",
      standaloneTitle: "Rewriting the Internal Narrative",
      description: "Use cognitive reframing to challenge distorted thinking patterns.",
      standaloneDescription: "Master cognitive reframing techniques to challenge the distorted thinking patterns that keep you feeling like a fraud despite your achievements.",
    },
    {
      title: "Building Your Evidence Portfolio",
      standaloneSlug: "building-evidence-portfolio",
      standaloneTitle: "Building Your Evidence Portfolio",
      description: "Create a concrete record of your achievements and positive feedback.",
      standaloneDescription: "Build a powerful evidence portfolio of your achievements, skills, and positive feedback — your antidote to imposter syndrome's selective memory.",
    },
    {
      title: "The Comparison Trap",
      standaloneSlug: "the-comparison-trap",
      standaloneTitle: "The Comparison Trap",
      description: "Break free from destructive comparison habits that fuel self-doubt.",
      standaloneDescription: "Understand how comparison fuels imposter syndrome and learn practical tools to break free from the comparison trap for good.",
    },
    {
      title: "Perfectionism to Excellence",
      standaloneSlug: "perfectionism-to-excellence",
      standaloneTitle: "Perfectionism to Excellence",
      description: "Shift from paralysing perfectionism to sustainable excellence.",
      standaloneDescription: "Learn the crucial difference between perfectionism and excellence, and develop sustainable standards that drive success without burnout.",
    },
    {
      title: "Living Beyond Imposter Syndrome",
      standaloneSlug: "living-beyond-imposter-syndrome",
      standaloneTitle: "Living Beyond Imposter Syndrome",
      description: "Build your personal toolkit for long-term confidence and achievement ownership.",
      standaloneDescription: "Create your personal anti-imposter toolkit, build a maintenance plan, and step fully into owning your success and achievements.",
    },
  ],

  "stress-to-strength": [
    {
      title: "Understanding Stress & Anxiety",
      standaloneSlug: "understanding-stress-anxiety",
      standaloneTitle: "Understanding Stress & Anxiety",
      description: "Learn the biology of stress, the difference between acute and chronic stress, and identify your stress signature.",
      standaloneDescription: "Understand the biology of stress, the feedback loop between stress and anxiety, and discover your unique stress signature to start managing it effectively.",
    },
    {
      title: "Your Nervous System Explained",
      standaloneSlug: "your-nervous-system-explained",
      standaloneTitle: "Your Nervous System Explained",
      description: "Understand your autonomic nervous system, polyvagal theory, and your window of tolerance.",
      standaloneDescription: "Demystify your nervous system — learn polyvagal theory, the four F responses, and your window of tolerance to understand why your body reacts the way it does.",
    },
    {
      title: "Emergency Toolkit",
      standaloneSlug: "emergency-anxiety-toolkit",
      standaloneTitle: "Emergency Anxiety Toolkit",
      description: "Master breathing, grounding, and physical techniques for immediate anxiety relief.",
      standaloneDescription: "Build your personal emergency toolkit with proven breathing, grounding, and physical techniques for immediate relief when anxiety or panic strikes.",
    },
    {
      title: "Cognitive Tools for Anxious Thoughts",
      standaloneSlug: "cognitive-tools-anxious-thoughts",
      standaloneTitle: "Cognitive Tools for Anxious Thoughts",
      description: "Apply CBT techniques including the ABCDE method and cognitive defusion.",
      standaloneDescription: "Master powerful CBT-based techniques including the ABCDE method, worry postponement, and cognitive defusion to take control of anxious thoughts.",
    },
    {
      title: "Breaking the Rumination Cycle",
      standaloneSlug: "breaking-rumination-cycle",
      standaloneTitle: "Breaking the Rumination Cycle",
      description: "Stop overthinking with attention redirection, mindfulness, and behavioural activation.",
      standaloneDescription: "Break free from the overthinking loop with proven techniques including attention redirection, mindfulness practices, and behavioural activation.",
    },
    {
      title: "Lifestyle Foundations",
      standaloneSlug: "lifestyle-foundations-anxiety",
      standaloneTitle: "Lifestyle Foundations for Anxiety",
      description: "Optimise sleep, movement, nutrition, and digital habits to reduce anxiety.",
      standaloneDescription: "Optimise the lifestyle foundations that directly impact anxiety — sleep, movement, nutrition, caffeine, alcohol, and digital wellness.",
    },
    {
      title: "Building a Resilience Mindset",
      standaloneSlug: "building-resilience-mindset",
      standaloneTitle: "Building a Resilience Mindset",
      description: "Develop true resilience through growth mindset and reframing adversity.",
      standaloneDescription: "Develop true resilience by cultivating a growth mindset, reframing adversity as opportunity, and building post-traumatic growth.",
    },
    {
      title: "Emotional Regulation Under Pressure",
      standaloneSlug: "emotional-regulation-under-pressure",
      standaloneTitle: "Emotional Regulation Under Pressure",
      description: "Manage triggers and regulate emotions in high-stress moments.",
      standaloneDescription: "Learn to prepare for anticipated stress, regulate emotions in real-time, manage difficult triggers, and recover effectively after pressure.",
    },
    {
      title: "Your Support System",
      standaloneSlug: "building-your-support-system",
      standaloneTitle: "Building Your Support System",
      description: "Map your support network and learn to ask for help effectively.",
      standaloneDescription: "Map your support network, learn to ask for help effectively, strengthen key relationships, and know when to seek professional support.",
    },
    {
      title: "Your Personal Wellness Plan",
      standaloneSlug: "personal-wellness-plan",
      standaloneTitle: "Your Personal Wellness Plan",
      description: "Integrate everything into a sustainable daily and weekly wellness routine.",
      standaloneDescription: "Bring everything together into a personalised, sustainable wellness plan with daily routines, weekly check-ins, and strategies for challenging times.",
    },
  ],

  "the-people-pleasing-cure": [
    {
      title: "Understanding People-Pleasing",
      standaloneSlug: "understanding-people-pleasing",
      standaloneTitle: "Understanding People-Pleasing",
      description: "Identify the signs, symptoms, and origins of people-pleasing behaviour.",
      standaloneDescription: "Discover what drives people-pleasing, recognise the signs in yourself, understand where it comes from, and see the true cost of always putting others first.",
    },
    {
      title: "The Fawn Response",
      standaloneSlug: "the-fawn-response",
      standaloneTitle: "The Fawn Response",
      description: "Understand people-pleasing as a nervous system survival response.",
      standaloneDescription: "Understand people-pleasing through the lens of your nervous system — learn about the fawn response, polyvagal theory, and how to begin self-regulation.",
    },
    {
      title: "Identifying Your Boundary Gaps",
      standaloneSlug: "identifying-boundary-gaps",
      standaloneTitle: "Identifying Your Boundary Gaps",
      description: "Audit your energy drains and map where boundaries are needed most.",
      standaloneDescription: "Conduct a thorough audit of your energy drains across work and personal life, and create a clear boundary map showing exactly where you need protection.",
    },
    {
      title: "The Art of Saying No",
      standaloneSlug: "the-art-of-saying-no",
      standaloneTitle: "The Art of Saying No",
      description: "Learn the boundary formula and practise saying no with confidence.",
      standaloneDescription: "Master the boundary formula, get ready-to-use scripts for common situations, and learn to say no with confidence while managing the discomfort that follows.",
    },
    {
      title: "Workplace Boundaries",
      standaloneSlug: "workplace-boundaries",
      standaloneTitle: "Workplace Boundaries",
      description: "Set effective boundaries with colleagues, managers, and in remote settings.",
      standaloneDescription: "Navigate workplace boundary challenges — manage your workload, handle colleague dynamics, set limits with your manager, and maintain digital boundaries.",
    },
    {
      title: "Boundaries in Close Relationships",
      standaloneSlug: "boundaries-close-relationships",
      standaloneTitle: "Boundaries in Close Relationships",
      description: "Set boundaries with family, partners, and friends without damaging relationships.",
      standaloneDescription: "Learn to set loving boundaries with family, romantic partners, and friends — protect your energy without sacrificing the relationships that matter most.",
    },
    {
      title: "Handling Pushback",
      standaloneSlug: "handling-boundary-pushback",
      standaloneTitle: "Handling Boundary Pushback",
      description: "Manage guilt, others' reactions, and maintain boundaries under pressure.",
      standaloneDescription: "Master the skills to handle guilt, shame, and other people's negative reactions when you set boundaries — even with difficult people and under pressure.",
    },
    {
      title: "Building a Boundaried Life",
      standaloneSlug: "building-a-boundaried-life",
      standaloneTitle: "Building a Boundaried Life",
      description: "Create a sustainable self-care practice and long-term boundary maintenance plan.",
      standaloneDescription: "Create a sustainable, boundaried life with genuine self-care practices, prevention strategies, and a long-term maintenance plan for lasting change.",
    },
  ],

  "the-empowered-empath": [
    {
      title: "Discovering Your Empath Nature",
      standaloneSlug: "discovering-your-empath-nature",
      standaloneTitle: "Discovering Your Empath Nature",
      description: "Understand what it means to be an empath and identify your empath type.",
      standaloneDescription: "Discover what it truly means to be an empath, identify which of the 5 empath types you are, and understand both the gifts and challenges of your sensitivity.",
    },
    {
      title: "The Empath's Nervous System",
      standaloneSlug: "the-empaths-nervous-system",
      standaloneTitle: "The Empath's Nervous System",
      description: "Understand the HSP nervous system and learn foundational regulation practices.",
      standaloneDescription: "Understand why your nervous system is wired differently as a highly sensitive person and learn foundational regulation practices to stay grounded.",
    },
    {
      title: "Energy Awareness",
      standaloneSlug: "empath-energy-awareness",
      standaloneTitle: "Energy Awareness for Empaths",
      description: "Distinguish your own energy from others' and recognise absorption patterns.",
      standaloneDescription: "Learn to distinguish your own emotions from others', understand how energy absorption happens, and recognise the signs of energetic overload.",
    },
    {
      title: "Protecting Your Energy",
      standaloneSlug: "protecting-your-energy",
      standaloneTitle: "Protecting Your Energy",
      description: "Master grounding, shielding, and energy clearing techniques.",
      standaloneDescription: "Master practical grounding, shielding, and energy clearing techniques to protect yourself from absorbing others' emotions and energy.",
    },
    {
      title: "Setting Energetic Boundaries",
      standaloneSlug: "setting-energetic-boundaries",
      standaloneTitle: "Setting Energetic Boundaries",
      description: "Communicate your needs and set boundaries as a sensitive person.",
      standaloneDescription: "Learn to set and communicate energetic boundaries with specific people and situations — including scripts for handling pushback and guilt.",
    },
    {
      title: "Healing Empath Burnout",
      standaloneSlug: "healing-empath-burnout",
      standaloneTitle: "Healing Empath Burnout",
      description: "Recognise burnout signs and recover physically, emotionally, and energetically.",
      standaloneDescription: "Recognise the unique signs of empath burnout and follow a structured recovery plan — physical, emotional, and energetic — back to balance.",
    },
    {
      title: "Empaths in Relationships",
      standaloneSlug: "empaths-in-relationships",
      standaloneTitle: "Empaths in Relationships",
      description: "Navigate partnership dynamics, communicate sensitivity, and handle conflict as an empath.",
      standaloneDescription: "Navigate the unique challenges empaths face in relationships — maintaining your identity, communicating your sensitivity, and handling conflict with care.",
    },
    {
      title: "Your Sensitivity as Strength",
      standaloneSlug: "sensitivity-as-strength",
      standaloneTitle: "Your Sensitivity as Strength",
      description: "Reframe your sensitivity and use your empathic gifts purposefully.",
      standaloneDescription: "Transform your perspective on sensitivity from weakness to superpower. Learn to use your empathic gifts purposefully and create your empowered empath vision.",
    },
  ],

  "love-reset": [
    {
      title: "Your Relationship Foundation",
      standaloneSlug: "your-relationship-foundation",
      standaloneTitle: "Your Relationship Foundation",
      description: "Assess the five areas of relationship health and set intentions for growth.",
      standaloneDescription: "Assess the five key areas of relationship health, understand your relationship history, identify warning signs and strengths, and set clear intentions.",
    },
    {
      title: "Communication Reset",
      standaloneSlug: "communication-reset",
      standaloneTitle: "Communication Reset",
      description: "Master effective speaking, deep listening, and eliminate communication killers.",
      standaloneDescription: "Transform how you and your partner communicate — master effective speaking, deep listening, and eliminate the communication killers that create distance.",
    },
    {
      title: "Rebuilding Emotional Intimacy",
      standaloneSlug: "rebuilding-emotional-intimacy",
      standaloneTitle: "Rebuilding Emotional Intimacy",
      description: "Deepen your emotional connection through love maps, emotional bids, and vulnerability.",
      standaloneDescription: "Rebuild the emotional connection that makes relationships thrive — through love maps, emotional bids, fondness and admiration, and vulnerability.",
    },
    {
      title: "Navigating Conflict Constructively",
      standaloneSlug: "navigating-conflict-constructively",
      standaloneTitle: "Navigating Conflict Constructively",
      description: "Apply the Four Horsemen antidotes, fair fighting rules, and repair attempts.",
      standaloneDescription: "Learn the antidotes to relationship-destroying conflict patterns, master fair fighting techniques, and use repair attempts to heal after disagreements.",
    },
    {
      title: "Rekindling Physical Intimacy",
      standaloneSlug: "rekindling-physical-intimacy",
      standaloneTitle: "Rekindling Physical Intimacy",
      description: "Reconnect physically through non-sexual touch, understanding desire, and communication.",
      standaloneDescription: "Rekindle physical connection through non-sexual touch, understanding desire dynamics, open communication about intimacy, and rekindling strategies.",
    },
    {
      title: "Creating Shared Meaning",
      standaloneSlug: "creating-shared-meaning",
      standaloneTitle: "Creating Shared Meaning",
      description: "Align core values, build rituals of connection, and pursue shared goals.",
      standaloneDescription: "Build a shared vision for your relationship — align core values, create meaningful rituals of connection, and pursue shared goals and dreams together.",
    },
    {
      title: "Managing External Stressors",
      standaloneSlug: "managing-external-stressors",
      standaloneTitle: "Managing External Stressors",
      description: "Protect your relationship from work stress, family dynamics, and financial pressure.",
      standaloneDescription: "Learn to protect your relationship from external pressures — work stress, extended family dynamics, financial strain, and major life transitions.",
    },
    {
      title: "Your Relationship Action Plan",
      standaloneSlug: "relationship-action-plan",
      standaloneTitle: "Your Relationship Action Plan",
      description: "Build a daily practice, prevention plan, and long-term maintenance strategy.",
      standaloneDescription: "Create your personalised relationship action plan with daily connection practices, prevention strategies, and a long-term maintenance commitment.",
    },
    {
      title: "Bonus: Transition to Parenthood",
      standaloneSlug: "transition-to-parenthood",
      standaloneTitle: "Transition to Parenthood",
      description: "Navigate identity shifts, stay partners while becoming parents, and maintain connection.",
      standaloneDescription: "Navigate the biggest relationship transition of all — identity shifts, staying partners while becoming parents, and maintaining connection in the chaos.",
    },
    {
      title: "Bonus: Communication When Exhausted",
      standaloneSlug: "communication-when-exhausted",
      standaloneTitle: "Communication When Exhausted",
      description: "Simplified communication tools, code words, and connection strategies for tired parents.",
      standaloneDescription: "When you're too tired to talk properly — simplified communication tools, code words, conflict shortcuts, and connection strategies for exhausted parents.",
    },
    {
      title: "Bonus: Division of Labour",
      standaloneSlug: "division-of-labour",
      standaloneTitle: "Division of Labour",
      description: "Create fair division of household and parenting responsibilities.",
      standaloneDescription: "Create a truly fair division of household and parenting work — understand the mental load, align on parenting, and build ongoing adjustment systems.",
    },
  ],

  "thriving-through-teen-years": [
    {
      title: "Understanding Your Teenage Brain",
      standaloneSlug: "understanding-your-teenage-brain",
      standaloneTitle: "Understanding Your Teenage Brain",
      description: "Learn how your brain is developing and why it affects your emotions, decisions, and sleep.",
      standaloneDescription: "Discover how your teenage brain is under construction — and why that affects your emotions, risk-taking, decision-making, and sleep. Knowledge is power.",
    },
    {
      title: "Building Your Self-Esteem Foundation",
      standaloneSlug: "teen-self-esteem-foundation",
      standaloneTitle: "Building Your Self-Esteem Foundation",
      description: "Break free from external validation traps and build genuine self-worth.",
      standaloneDescription: "Break free from the external validation traps that target teenagers and build a genuine foundation of self-worth that doesn't depend on likes or approval.",
    },
    {
      title: "Silencing the Inner Critic",
      standaloneSlug: "teen-silencing-inner-critic",
      standaloneTitle: "Silencing the Inner Critic",
      description: "Recognise, challenge, and replace self-critical thoughts with a supportive inner coach.",
      standaloneDescription: "Recognise the inner critic that tells you you're not good enough, learn to challenge it, and build a supportive inner coach in its place.",
    },
    {
      title: "Social Media & Self-Worth",
      standaloneSlug: "social-media-and-self-worth",
      standaloneTitle: "Social Media & Self-Worth",
      description: "Navigate social media without letting it damage your self-image.",
      standaloneDescription: "Understand how social media is designed to make you compare and feel inadequate — and learn to use it intentionally without it damaging your self-worth.",
    },
    {
      title: "Handling Peer Pressure",
      standaloneSlug: "handling-peer-pressure",
      standaloneTitle: "Handling Peer Pressure",
      description: "Know your values, develop response strategies, and find your people.",
      standaloneDescription: "Learn the difference between positive and negative peer influence, develop practical response strategies, and find the people who lift you up.",
    },
    {
      title: "Stress, Anxiety & Overwhelm",
      standaloneSlug: "teen-stress-anxiety-overwhelm",
      standaloneTitle: "Stress, Anxiety & Overwhelm",
      description: "Understand anxiety, get immediate relief tools, and build healthy lifestyle habits.",
      standaloneDescription: "Understand what anxiety actually is, get immediate relief tools for when it hits, learn to manage anxious thoughts, and build healthy lifestyle foundations.",
    },
    {
      title: "Communication Skills",
      standaloneSlug: "teen-communication-skills",
      standaloneTitle: "Teen Communication Skills",
      description: "Express yourself clearly, listen effectively, and handle difficult conversations.",
      standaloneDescription: "Master the communication skills that will serve you for life — expressing yourself clearly, listening well, being assertive, and handling difficult conversations.",
    },
    {
      title: "Your Future Self",
      standaloneSlug: "your-future-self",
      standaloneTitle: "Your Future Self",
      description: "Clarify your values, set meaningful goals, and build resilience for the journey.",
      standaloneDescription: "Connect with your future self, clarify your values and direction, set goals that actually work, and build the resilience to handle obstacles along the way.",
    },
  ],

  "executive-presence": [
    {
      title: "Understanding Executive Presence",
      standaloneSlug: "understanding-executive-presence",
      standaloneTitle: "Understanding Executive Presence",
      description: "Define executive presence, assess yourself against the three pillars, and identify barriers.",
      standaloneDescription: "Understand what executive presence really means, assess yourself against the three-pillar framework, and identify the internal barriers holding you back.",
    },
    {
      title: "Confident Communication",
      standaloneSlug: "confident-professional-communication",
      standaloneTitle: "Confident Professional Communication",
      description: "Speak with authority, eliminate undermining habits, and master strategic listening.",
      standaloneDescription: "Learn to speak with clarity and authority, eliminate the habits that undermine your credibility, master non-verbal communication, and become a strategic listener.",
    },
    {
      title: "Owning the Room",
      standaloneSlug: "owning-the-room",
      standaloneTitle: "Owning the Room",
      description: "Deliver presentations with confidence, manage nerves, and engage your audience.",
      standaloneDescription: "Transform your presentation skills — build the right mindset, prepare effectively, manage nerves, command attention, and genuinely engage your audience.",
    },
    {
      title: "High-Stakes Conversations",
      standaloneSlug: "high-stakes-conversations",
      standaloneTitle: "High-Stakes Conversations",
      description: "Prepare for, deliver, and navigate difficult professional conversations.",
      standaloneDescription: "Master the art of high-stakes conversations — prepare strategically, deliver difficult messages with confidence, and stay composed under pressure.",
    },
    {
      title: "Negotiating Your Worth",
      standaloneSlug: "negotiating-your-worth",
      standaloneTitle: "Negotiating Your Worth",
      description: "Develop a negotiation mindset and master salary and career negotiations.",
      standaloneDescription: "Shift your negotiation mindset, know your true market worth, prepare strategically, and master both salary negotiations and beyond-salary opportunities.",
    },
    {
      title: "Leading with Authenticity",
      standaloneSlug: "leading-with-authenticity",
      standaloneTitle: "Leading with Authenticity",
      description: "Define your leadership values and style without falling into performance mode.",
      standaloneDescription: "Define authentic leadership on your own terms — discover your leadership values, develop your unique style, and lead with genuine vulnerability and strength.",
    },
    {
      title: "Managing Up & Across",
      standaloneSlug: "managing-up-and-across",
      standaloneTitle: "Managing Up & Across",
      description: "Build strategic relationships with managers, peers, and navigate organisational politics.",
      standaloneDescription: "Master the art of managing up and across — build strategic relationships with your manager, influence without authority, and navigate organisational politics.",
    },
    {
      title: "Building Your Professional Brand",
      standaloneSlug: "building-professional-brand",
      standaloneTitle: "Building Your Professional Brand",
      description: "Define your brand, increase visibility, build your network, and manage your reputation.",
      standaloneDescription: "Define and build a professional brand that opens doors — increase your visibility, expand your network strategically, and manage your reputation with intention.",
    },
  ],

  "body-neutral": [
    {
      title: "Understanding Body Image",
      standaloneSlug: "understanding-body-image",
      standaloneTitle: "Understanding Body Image",
      description: "Explore the four components of body image and assess where you are on the spectrum.",
      standaloneDescription: "Explore the four components of body image, understand how your relationship with your body developed, and assess where you are on the body image spectrum.",
    },
    {
      title: "The Body Story",
      standaloneSlug: "the-body-story",
      standaloneTitle: "The Body Story",
      description: "Trace your body image history and recognise that limiting beliefs were given, not chosen.",
      standaloneDescription: "Trace the history of your relationship with your body — the early messages, turning points, and external influences. Your limiting beliefs were given, not chosen.",
    },
    {
      title: "From Positive to Neutral",
      standaloneSlug: "from-positive-to-neutral",
      standaloneTitle: "From Body Positive to Body Neutral",
      description: "Understand why body positivity can feel unachievable and explore body neutrality as an alternative.",
      standaloneDescription: "Discover why body positivity can feel forced and unachievable, and explore body neutrality as a realistic, sustainable alternative that actually works.",
    },
    {
      title: "Healing Body Shame",
      standaloneSlug: "healing-body-shame",
      standaloneTitle: "Healing Body Shame",
      description: "Understand body shame, practise self-compassion, and build body safety.",
      standaloneDescription: "Understand the deep impact of body shame, build a self-compassion foundation, release judgement, and create a sense of safety in your own body.",
    },
    {
      title: "Beyond Appearance",
      standaloneSlug: "beyond-appearance",
      standaloneTitle: "Beyond Appearance",
      description: "Shift focus from how your body looks to what it does for you.",
      standaloneDescription: "Make the transformative shift from focusing on how your body looks to appreciating what it does — body gratitude, movement for joy, and living in function.",
    },
    {
      title: "Body Image in Relationships",
      standaloneSlug: "body-image-in-relationships",
      standaloneTitle: "Body Image in Relationships",
      description: "Navigate intimacy, vulnerability, and partner dynamics with body image challenges.",
      standaloneDescription: "Understand how body image affects your relationships, navigate intimacy and vulnerability, communicate your needs, and build intimacy confidence.",
    },
    {
      title: "Dressing for You",
      standaloneSlug: "dressing-for-you",
      standaloneTitle: "Dressing for You",
      description: "Release size attachment and dress for comfort, joy, and self-expression.",
      standaloneDescription: "Transform your relationship with clothing — release size attachment, dress for your body now, prioritise comfort, and use style as authentic self-expression.",
    },
    {
      title: "Living in Your Body",
      standaloneSlug: "living-in-your-body",
      standaloneTitle: "Living in Your Body",
      description: "Move from body image work to true embodiment and long-term body peace.",
      standaloneDescription: "Move from body image work to true embodiment — practise sensory engagement, create your body peace plan, and build sustainable long-term body acceptance.",
    },
  ],
};

async function main() {
  console.log("Seeding modules for all courses...\n");

  const allCourses = await prisma.course.findMany();

  for (const [courseSlug, modules] of Object.entries(courseModules)) {
    const course = allCourses.find((c) => c.slug === courseSlug);
    if (!course) {
      console.log(`  SKIP: Course "${courseSlug}" not found in DB`);
      continue;
    }

    const category = courseCategories[courseSlug] || "self_esteem";
    console.log(`  ${course.title} (${modules.length} modules)`);

    for (let i = 0; i < modules.length; i++) {
      const m = modules[i];
      const existing = await prisma.module.findFirst({
        where: { standaloneSlug: m.standaloneSlug },
      });

      const data = {
        title: m.title,
        description: m.description,
        sortOrder: i,
        standaloneSlug: m.standaloneSlug,
        standaloneTitle: m.standaloneTitle,
        standaloneDescription: m.standaloneDescription,
        standalonePrice: MODULE_PRICE,
        standaloneCategory: category,
        isStandalonePublished: true,
      };

      if (existing) {
        await prisma.module.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await prisma.module.create({
          data: { ...data, courseId: course.id },
        });
      }
    }
  }

  // Update module counts on courses
  for (const course of allCourses) {
    const count = await prisma.module.count({ where: { courseId: course.id } });
    if (count > 0) {
      await prisma.course.update({
        where: { id: course.id },
        data: { modulesCount: count },
      });
    }
  }

  console.log("\nDone! All modules seeded and published as standalone short courses.");
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
