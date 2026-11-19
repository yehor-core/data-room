import { validateUpload } from '@/data/uploads';

const MB = 1024 * 1024;

describe('validateUpload', () => {
  it('accepts a PDF up to and including 4 MB', () => {
    expect(validateUpload({ size: 1, type: 'application/pdf' })).toBeNull();
    expect(validateUpload({ size: 4 * MB, type: 'application/pdf' })).toBeNull();
  });

  it('rejects a file over 4 MB, naming the limit', () => {
    expect(validateUpload({ size: 4 * MB + 1, type: 'application/pdf' })).toBe(
      'File is too large. The maximum size is 4 MB.',
    );
  });

  it.each(['text/plain', 'image/png', ''])('rejects a file of type "%s"', (type) => {
    expect(validateUpload({ size: 100, type })).toBe('Only PDF files are accepted.');
  });
});
