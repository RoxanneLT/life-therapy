import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  // Delete all existing testimonials
  await prisma.testimonial.deleteMany();
  console.log("Cleared existing testimonials");

  const testimonials = [
    {
      name: "Frances MacMahon",
      location: "Knysna, Western Cape",
      content:
        "I can\u2019t recommend Roxanne highly enough. Working online with her has truly been life-changing. She created such a warm, supportive space where I always felt heard, understood, and gently guided. Her insight, compassion, and care made a meaningful difference in my life, and I\u2019m incredibly grateful for everything she\u2019s helped me work through and all the tools I\u2019ve gained along the way. If you\u2019re looking for a skilled and genuinely caring therapist, Roxanne is exceptional.",
      rating: 5,
      serviceType: "session",
      isPublished: true,
      isFeatured: true,
      sortOrder: 1,
    },
    {
      name: "Casey-Lea Olson",
      location: "Johannesburg, South Africa",
      content:
        "Roxanne was a Godsend. At a time when I was at my lowest, she helped me get through it and believe in me again. And it was done with patience, kindness and understanding.\nThank you for all you have done!!!",
      rating: 5,
      serviceType: "session",
      isPublished: true,
      isFeatured: true,
      sortOrder: 2,
    },
    {
      name: "Tasmin Mackier",
      location: "Paarl, Western Cape",
      content:
        "Roxanne has been an incredible online support in my journey towards personal growth. Through her guidance at Life-Therapy, I\u2019ve gained invaluable tools that have empowered me to navigate life\u2019s challenges with more confidence and clarity. One area where I\u2019ve particularly benefited is in setting boundaries; Roxanne\u2019s insights and strategies have helped me develop the confidence to establish and maintain healthy boundaries in my relationships. I\u2019m grateful for her expertise and compassionate approach, which have made a positive difference in my life. I highly recommend Roxanne to anyone seeking effective and empathetic therapy.",
      rating: 5,
      serviceType: "session",
      isPublished: true,
      isFeatured: true,
      sortOrder: 3,
    },
    {
      name: "Tanya Willmans",
      location: "United Kingdom",
      content:
        "I found Roxanne enormously helpful when getting ready for university. I needed help getting myself and my family organized going into my second year of studying, and Roxanne was an amazing resource for me. My family and I live in the UK, so with the online option for my sessions were so convenient. Roxanne was innovative and provided alternative ideas and thoughts for me. I would highly recommend this service to all who require direction in their lives. Roxanne was a positive influence and you\u2019ll only learn great things from her abundant skills and knowledge.",
      rating: 5,
      serviceType: "session",
      isPublished: true,
      isFeatured: false,
      sortOrder: 4,
    },
    {
      name: "Parboti Roy",
      role: "Graduate Student",
      location: "Canada",
      content:
        "Roxanne is a great online counsellor! She has constantly given me positive vibes, encouragement and helped me to overcome my depression and emotional trauma. As a graduate student I believe that we need counseling to manage our stress and depression, and I highly recommend Roxanne for her great service.",
      rating: 5,
      serviceType: "session",
      isPublished: true,
      isFeatured: false,
      sortOrder: 5,
    },
    {
      name: "Richard Beckman",
      location: "Canada",
      content:
        "I found Roxanne warm, friendly, incisive and most helpful in dealing with my relationships with both my family members and friends. With her engaging feedback I have learned to understand much more about myself and how to interact with others. I have no hesitation in recommending her services. She is very good.",
      rating: 5,
      serviceType: "session",
      isPublished: true,
      isFeatured: false,
      sortOrder: 6,
    },
    {
      name: "Thomas Beckman",
      location: "Canada",
      content:
        "Roxanne\u2019s approach was very uplifting and encouraging in the best possible sense. Her genuine interest and affordability gave me a viable and practical solution to some very tricky challenges. I highly recommend her counselling services.",
      rating: 5,
      serviceType: "session",
      isPublished: true,
      isFeatured: false,
      sortOrder: 7,
    },
  ];

  for (const t of testimonials) {
    await prisma.testimonial.create({ data: t });
    console.log(`Created: ${t.name}`);
  }

  console.log(`\nDone! ${testimonials.length} testimonials inserted.`);
  await pool.end();
}

main().catch(console.error);
