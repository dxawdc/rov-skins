export function formatDisplayDate(date: string | null): string {
  if (!date) return '未知';
  return date.replace(/-/g, '/');
}

export function getRecentCutoff(days: number): number {
  const value = new Date();
  value.setDate(value.getDate() - days);
  value.setHours(0, 0, 0, 0);
  return value.getTime();
}

export function toTime(date: string | null): number {
  if (!date) return 0;
  const value = new Date(date).getTime();
  return Number.isNaN(value) ? 0 : value;
}
