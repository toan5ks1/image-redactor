import { EntityCategory } from '../../domain/sensitive-entity';

export interface CategoryMeta {
  label: string;
  short: string;
  color: string;
  bgColor: string;
  borderColor: string;
  iconName: string;
  description: string;
}

export const CATEGORY_CONFIG: Record<EntityCategory, CategoryMeta> = {
  secret: {
    label: 'API Key / Secret',
    short: 'SEC',
    color: '#f87171',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
    iconName: 'Key',
    description: 'API keys, tokens, JWTs, and private credentials',
  },
  password: {
    label: 'Password / Auth',
    short: 'PASS',
    color: '#fb923c',
    bgColor: 'rgba(249, 115, 22, 0.15)',
    borderColor: '#f97316',
    iconName: 'Lock',
    description: 'Passwords, authorization headers, hashes',
  },
  email: {
    label: 'Email Address',
    short: 'EMAIL',
    color: '#38bdf8',
    bgColor: 'rgba(14, 165, 233, 0.15)',
    borderColor: '#0ea5e9',
    iconName: 'Mail',
    description: 'Personal or work email addresses',
  },
  phone: {
    label: 'Phone Number',
    short: 'PHONE',
    color: '#fbbf24',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#f59e0b',
    iconName: 'Phone',
    description: 'Mobile and landline telephone numbers',
  },
  person: {
    label: 'Person Name',
    short: 'PER',
    color: '#a78bfa',
    bgColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: '#8b5cf6',
    iconName: 'User',
    description: 'Names of individuals or customers',
  },
  account: {
    label: 'Account / Financial',
    short: 'ACCT',
    color: '#e879f9',
    bgColor: 'rgba(217, 70, 239, 0.15)',
    borderColor: '#d946ef',
    iconName: 'CreditCard',
    description: 'Bank accounts, credit cards, customer IDs',
  },
  address: {
    label: 'Physical Address',
    short: 'ADDR',
    color: '#34d399',
    bgColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
    iconName: 'MapPin',
    description: 'Street, postal address, city or country',
  },
  url: {
    label: 'Sensitive URL / Link',
    short: 'URL',
    color: '#60a5fa',
    bgColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: '#3b82f6',
    iconName: 'Link',
    description: 'URLs containing tokens, query params or reset links',
  },
  date: {
    label: 'Date of Birth / Date',
    short: 'DATE',
    color: '#2dd4bf',
    bgColor: 'rgba(20, 184, 166, 0.15)',
    borderColor: '#14b8a6',
    iconName: 'Calendar',
    description: 'Sensitive dates, birthdays or timestamps',
  },
  custom: {
    label: 'Manual Redaction',
    short: 'USER',
    color: '#94a3b8',
    bgColor: 'rgba(148, 163, 184, 0.15)',
    borderColor: '#94a3b8',
    iconName: 'Square',
    description: 'User-drawn manual redaction region',
  },
};
