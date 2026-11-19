import { checkUpload } from '../uploads';

const pdf = (bytes: number) => Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(bytes - 9, 'a')]);
const failure = (input: Parameters<typeof checkUpload>[0]) => {
  try {
    checkUpload(input);
  } catch (error) {
    return error;
  }
  return undefined;
};

describe('checkUpload', () => {
  it('accepts a PDF up to 4 MB', () => {
    expect(failure({ mimeType: 'application/pdf', content: pdf(4 * 1024 * 1024) })).toBeUndefined();
  });

  it('rejects a file over 4 MB, saying what the limit is', () => {
    expect(failure({ mimeType: 'application/pdf', content: pdf(4 * 1024 * 1024 + 1) })).toMatchObject({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'File is larger than the 4 MB limit',
    });
  });

  it.each([
    ['a type other than PDF', 'image/png', pdf(100)],
    ['PDF type with content that is not a PDF', 'application/pdf', Buffer.from('<html></html>')],
    ['empty content', 'application/pdf', Buffer.alloc(0)],
  ])('rejects %s', (_case, mimeType, content) => {
    expect(failure({ mimeType, content })).toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' });
  });
});
