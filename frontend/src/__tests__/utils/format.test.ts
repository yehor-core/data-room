import { formatBytes, formatDate } from '../../lib/utils';

describe('Format Utilities', () => {
  describe('formatBytes', () => {
    it('formats bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
    });

    it('handles decimal places', () => {
      expect(formatBytes(1536, 0)).toBe('2 KB');
      expect(formatBytes(1536, 2)).toBe('1.5 KB');
    });

    it('handles large numbers', () => {
      const result = formatBytes(1099511627776);
      expect(result).toContain('TB');
    });

    it('handles string inputs (BigInt serialization)', () => {
      expect(formatBytes('1024')).toBe('1 KB');
      expect(formatBytes('1048576')).toBe('1 MB');
      expect(formatBytes('0')).toBe('0 Bytes');
    });

    it('handles invalid inputs', () => {
      expect(formatBytes('invalid')).toBe('0 Bytes');
      expect(formatBytes(NaN)).toBe('0 Bytes');
    });
  });

  describe('formatDate', () => {
    it.each([
      ['an ISO string', '2024-01-15T10:30:00'],
      ['a Date', new Date(2024, 0, 15, 10, 30)],
    ])('formats %s as a short US date and time', (_, date) => {
      expect(formatDate(date)).toBe('Jan 15, 2024, 10:30 AM');
    });

    it('reports an unparseable date as invalid', () => {
      expect(formatDate('invalid-date')).toBe('Invalid date');
    });

    it.each([
      ['an empty string', ''],
      ['null', null as any],
      ['undefined', undefined as any],
    ])('reports %s as an unknown date', (_, date) => {
      expect(formatDate(date)).toBe('Unknown date');
    });
  });
});
