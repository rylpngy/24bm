import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** 合并 Tailwind 类名，后者覆盖前者冲突项。shadcn 标准工具。 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
