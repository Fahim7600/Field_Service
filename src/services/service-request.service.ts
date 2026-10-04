import type { Prisma } from '@prisma/client';

export const generateRequestNumber = async (tx: Prisma.TransactionClient): Promise<string> => {
  const result = await tx.$queryRaw<
    Array<{ nextval: bigint | number | string }>
  >`SELECT nextval('service_request_number_seq') AS nextval`;
  if (!result || result.length === 0) {
    throw new Error('Failed to generate request number');
  }
  const seqNumber = Number(result[0].nextval);
  const year = new Date().getUTCFullYear();
  const padded = String(seqNumber).padStart(6, '0');
  return `SR-${year}-${padded}`;
};
