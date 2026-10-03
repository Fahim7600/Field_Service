import crypto from 'node:crypto';

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const ALL = UPPER + LOWER + DIGITS;

const getRandomChar = (chars: string): string => {
  const idx = crypto.randomInt(0, chars.length);
  return chars[idx];
};

export const generateOneTimePassword = (): string => {
  const chars: string[] = [];

  // At least 2 of each class
  chars.push(getRandomChar(UPPER));
  chars.push(getRandomChar(UPPER));
  chars.push(getRandomChar(LOWER));
  chars.push(getRandomChar(LOWER));
  chars.push(getRandomChar(DIGITS));
  chars.push(getRandomChar(DIGITS));

  // Remaining 6 characters from all allowed characters
  for (let i = 0; i < 6; i++) {
    chars.push(getRandomChar(ALL));
  }

  // Crypto-based Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const temp = chars[i];
    chars[i] = chars[j];
    chars[j] = temp;
  }

  return chars.join('');
};
