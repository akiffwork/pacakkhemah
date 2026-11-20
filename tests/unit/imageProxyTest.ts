import { isAllowedImageUrl } from '@/lib/imageProxy';

test('only our image storage, over https', () => {
  expect(isAllowedImageUrl('https://firebasestorage.googleapis.com/v0/b/x/o/gear%2Fa.jpg?alt=media')).toBe(true);
  expect(isAllowedImageUrl('https://storage.googleapis.com/bucket/a.jpg')).toBe(true);
  for (const bad of ['http://firebasestorage.googleapis.com/a.jpg', 'https://evil.example/a.jpg', 'http://169.254.169.254/latest/meta-data',
    'https://firebasestorage.googleapis.com.evil.example/a.jpg', 'javascript:alert(1)', 'not a url']) {
    expect(isAllowedImageUrl(bad)).toBe(false);
  }
});
