import { EMPTY_SHA256, signS3Request } from 'src/storage/s3-signature';

describe('signS3Request', () => {
  // The "GET Object" example of AWS's Signature Version 4 documentation for S3
  // (sig-v4-header-based-auth): same inputs must give the documented signature.
  it('matches the AWS documentation example', () => {
    const authorization = signS3Request({
      method: 'GET',
      path: '/test.txt',
      headers: {
        host: 'examplebucket.s3.amazonaws.com',
        range: 'bytes=0-9',
        'x-amz-content-sha256': EMPTY_SHA256,
        'x-amz-date': '20130524T000000Z',
      },
      payloadHash: EMPTY_SHA256,
      credentials: {
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-east-1',
      },
      date: new Date('2013-05-24T00:00:00Z'),
    });
    expect(authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, ' +
        'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, ' +
        'Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    );
  });
});
