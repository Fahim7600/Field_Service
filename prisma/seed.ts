import { PlanInterval, PrismaClient, Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const prisma = new PrismaClient();

const seedEnvSchema = z.object({
  ADMIN_NAME: z.string().min(1, 'ADMIN_NAME is required'),
  ADMIN_EMAIL: z.string().email('ADMIN_EMAIL must be a valid email'),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD must be at least 8 characters'),
});

const envResult = seedEnvSchema.safeParse(process.env);

if (!envResult.success) {
  console.error('Invalid environment variables for seeding:', envResult.error.format());
  process.exit(1);
}

const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = envResult.data;

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const adminUser = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: ADMIN_NAME,
      passwordHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
    },
    create: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
    },
  });

  const skillData = [
    { name: 'AC Repair' },
    { name: 'Plumbing' },
    { name: 'Electrical Work' },
    { name: 'Appliance Repair' },
  ];

  const skillMap: Record<string, string> = {};
  for (const s of skillData) {
    const createdSkill = await prisma.skill.upsert({
      where: { name: s.name },
      update: {},
      create: { name: s.name },
    });
    skillMap[createdSkill.name] = createdSkill.id;
  }

  const categoryData = [
    { name: 'AC Repair', basePriceCents: 3000 },
    { name: 'Plumbing', basePriceCents: 2500 },
    { name: 'Electrical Work', basePriceCents: 2000 },
    { name: 'Appliance Repair', basePriceCents: 2500 },
  ];

  for (const cat of categoryData) {
    const skillId = skillMap[cat.name];
    await prisma.serviceCategory.upsert({
      where: { name: cat.name },
      update: {
        basePriceCents: cat.basePriceCents,
        skillId,
      },
      create: {
        name: cat.name,
        basePriceCents: cat.basePriceCents,
        skillId,
      },
    });
  }

  const planData = [
    { name: 'Premium Monthly', interval: PlanInterval.MONTH, priceCents: 500, currency: 'usd' },
    { name: 'Premium Yearly', interval: PlanInterval.YEAR, priceCents: 5000, currency: 'usd' },
  ];

  for (const plan of planData) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: {
        interval: plan.interval,
        priceCents: plan.priceCents,
        currency: plan.currency,
      },
      create: {
        name: plan.name,
        interval: plan.interval,
        priceCents: plan.priceCents,
        currency: plan.currency,
      },
    });
  }

  const skillCount = await prisma.skill.count();
  const categoryCount = await prisma.serviceCategory.count();
  const planCount = await prisma.subscriptionPlan.count();

  console.log('Database seeded successfully.');
  console.log(`Admin email: ${adminUser.email}`);
  console.log(`Skills count: ${skillCount}`);
  console.log(`Categories count: ${categoryCount}`);
  console.log(`Subscription plans count: ${planCount}`);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
