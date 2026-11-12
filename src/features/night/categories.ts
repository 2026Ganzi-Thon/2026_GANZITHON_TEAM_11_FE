import type { CategoryId } from './entry';
export type WorryCategory = {
  id: CategoryId;
  label: string;
  color: string;
  stripe: string;
  height: number;
};
export const categories: readonly WorryCategory[] = [
  {
    id: 'romance',
    label: '연애',
    color: '#F9CFDD',
    stripe: '#C4ABD3',
    height: 150,
  },
  {
    id: 'career',
    label: '취업',
    color: '#FFE7A3',
    stripe: '#C8BCA9',
    height: 140,
  },
  {
    id: 'study',
    label: '학업',
    color: '#CFDBFA',
    stripe: '#A6B4E8',
    height: 156,
  },
  {
    id: 'health',
    label: '건강',
    color: '#B7E3CC',
    stripe: '#94BAC6',
    height: 136,
  },
  {
    id: 'relationships',
    label: '대인관계',
    color: '#E2D6F8',
    stripe: '#B3B0E6',
    height: 152,
  },
  {
    id: 'family',
    label: '가족',
    color: '#D6A8FF',
    stripe: '#AB8FEB',
    height: 144,
  },
  {
    id: 'other',
    label: '기타',
    color: '#7180DA',
    stripe: '#6272D0',
    height: 138,
  },
  {
    id: 'none',
    label: '고민 없음',
    color: '#A9AECB',
    stripe: '#8A93C6',
    height: 148,
  },
];
