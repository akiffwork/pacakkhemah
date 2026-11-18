import { formatIc, formatPassport, formatIdNumber, idNumberError, idLine } from '@/lib/customerId';

describe('customerId', () => {
  test('formats MyKad digits as 000000-00-0000 while typing', () => {
    expect(formatIc('9001')).toBe('9001');
    expect(formatIc('9001011')).toBe('900101-1');
    expect(formatIc('900101145678')).toBe('900101-14-5678');
    expect(formatIc('900101-14-5678999')).toBe('900101-14-5678');
    expect(formatIc('90 01 01 abc 14')).toBe('900101-14');
  });

  test('passport numbers are uppercase letters and digits', () => {
    expect(formatPassport('a12 345-678')).toBe('A12345678');
    expect(formatIdNumber('passport', 'k1234567')).toBe('K1234567');
    expect(formatIdNumber('ic', '900101145678')).toBe('900101-14-5678');
  });

  test('validates IC numbers', () => {
    expect(idNumberError('ic', '')).toMatch(/enter/);
    expect(idNumberError('ic', '900101-14')).toMatch(/12 digits/);
    expect(idNumberError('ic', '901301-14-5678')).toMatch(/birth date/);
    expect(idNumberError('ic', '900101-14-5678')).toBe('');
  });

  test('validates passport numbers', () => {
    expect(idNumberError('passport', '')).toMatch(/enter/);
    expect(idNumberError('passport', 'A123')).toMatch(/short/);
    expect(idNumberError('passport', 'ABCDEFG')).toMatch(/check/);
    expect(idNumberError('passport', 'A12345678')).toBe('');
  });

  test('idLine labels the number, defaulting to IC', () => {
    expect(idLine('passport', 'A1')).toBe('Passport No. A1');
    expect(idLine(undefined, '900101-14-5678')).toBe('IC No. 900101-14-5678');
    expect(idLine('ic', '')).toBe('');
  });
});
