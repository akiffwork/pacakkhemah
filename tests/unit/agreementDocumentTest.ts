import { vendorTerms, generalTerms, socialLinks, shopAddress, formatSignedAt, verificationCode, signatureMatches, declarationText } from '@/lib/agreementDocument';
import { DEFAULT_RULES } from '@/lib/vendorSettings';

describe('agreementDocument', () => {
  test('vendor rules, falling back to the suggested rules', () => {
    expect(vendorTerms([' A ', '', 'B'])).toEqual(['A', 'B']);
    expect(vendorTerms([])).toEqual(DEFAULT_RULES);
  });

  test('general terms cover validity, e-signatures, law and platform', () => {
    const t = generalTerms().join(' ');
    for (const k of ['Validity.', 'Digital signatures.', 'Electronic Commerce Act 2006', 'Governing law.', 'not a party']) expect(t).toContain(k);
  });

  test('social links from handles or URLs', () => {
    expect(socialLinks({ name: 'V', phone: '013-240 4336', ig: '@camp.kita', tiktok: 'https://www.tiktok.com/@campkita', fb: 'facebook.com/campkita/', threads: 'campkita' })).toEqual([
      { icon: 'whatsapp', label: '+60132404336', url: 'https://wa.me/60132404336' },
      { icon: 'instagram', label: '@camp.kita', url: 'https://instagram.com/camp.kita' },
      { icon: 'tiktok', label: '@campkita', url: 'https://www.tiktok.com/@campkita' },
      { icon: 'facebook', label: '@campkita', url: 'https://facebook.com/campkita' },
      { icon: 'threads', label: '@campkita', url: 'https://www.threads.net/@campkita' },
    ]);
  });

  test('shop address and Malaysia-time signing date', () => {
    expect(shopAddress('camp-kita')).toBe('pacakkhemah.com/shop/camp-kita');
    expect(shopAddress()).toBe('pacakkhemah.com');
    expect(formatSignedAt(new Date('2026-11-18T02:27:00Z'))).toBe('18 Nov 2026, 10:27 am (GMT+8)');
  });

  test('verification code is stable and changes with content', async () => {
    const a = await verificationCode({ b: 1, a: [1, 2] });
    expect(a).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
    expect(await verificationCode({ a: [1, 2], b: 1 })).toBe(a);
    expect(await verificationCode({ a: [1, 2], b: 2 })).not.toBe(a);
  });

  test('signature must match the name', () => {
    expect(signatureMatches('ali  bin ahmad ', 'ALI BIN AHMAD')).toBe(true);
    expect(signatureMatches('ali', 'ALI BIN AHMAD')).toBe(false);
    expect(signatureMatches('', '')).toBe(false);
  });

  test('declaration names the customer and ID', () => {
    expect(declarationText({ name: 'ALI' }, 'IC No. 900101-14-5678')).toMatch(/^I, ALI \(IC No\. 900101-14-5678\), confirm/);
  });
});
