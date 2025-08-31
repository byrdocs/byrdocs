import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function arrayEqual<T>(a: T[], b: T[]) {
  return a.length === b.length && a.every((value, index) => value === b[index])
}