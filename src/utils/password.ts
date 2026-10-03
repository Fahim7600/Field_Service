import bcrypt from 'bcryptjs';

export const DUMMY_HASH = bcrypt.hashSync('dummy_password_for_timing_attack_mitigation', 12);

export const hashPassword = async (plain: string): Promise<string> => {
  return bcrypt.hash(plain, 12);
};

export const comparePassword = async (plain: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(plain, hash);
};
