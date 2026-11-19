const MINIMAL_PDF = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 200 200]>> endobj
trailer <</Root 1 0 R>>
%%EOF
`;

/** The upload limit from the API contract: 4 MB, inclusive. */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const pdf = (name: string) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from(MINIMAL_PDF),
});

/** A PDF one byte over the limit. */
export const oversizedPdf = (name: string) => {
  const buffer = Buffer.alloc(MAX_UPLOAD_BYTES + 1, ' ');
  buffer.write(MINIMAL_PDF);
  return { name, mimeType: 'application/pdf', buffer };
};

export const textFile = (name: string) => ({
  name,
  mimeType: 'text/plain',
  buffer: Buffer.from('Not a PDF.\n'),
});
