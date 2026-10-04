import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const generateInvoiceNumber = async (
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string> => {
  const result = await tx.$queryRaw<
    { nextval: bigint }[]
  >`SELECT nextval('invoice_number_seq') AS nextval`;
  const nextVal = Number(result[0].nextval);
  const year = new Date().getUTCFullYear();
  const sequenceStr = String(nextVal).padStart(6, '0');
  return `INV-${year}-${sequenceStr}`;
};
