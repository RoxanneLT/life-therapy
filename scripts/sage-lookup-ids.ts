import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const results = await prisma.student.findMany({
    where: {
      OR: [
        { email: "simonekilian1987@gmail.com" },
        { firstName: { contains: "Winifred", mode: "insensitive" } },
        { firstName: { contains: "Simone", mode: "insensitive" } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  results.forEach((s) => console.log(s.id, s.firstName, s.lastName, s.email));
}

main().catch(console.error).finally(() => prisma.$disconnect());
