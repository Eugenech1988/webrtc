import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function index(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
