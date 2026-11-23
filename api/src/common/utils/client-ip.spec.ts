import {
  CLIENT_IP_HEADER,
  clientIp,
  PROXY_SECRET_HEADER,
} from 'src/common/utils/client-ip';

describe('clientIp', () => {
  const secret = 'shared-web-secret';

  it('uses the forwarded visitor IP when the web server proves itself', () => {
    const ip = clientIp(
      {
        ip: '10.0.0.1',
        headers: {
          [CLIENT_IP_HEADER]: '203.0.113.7',
          [PROXY_SECRET_HEADER]: secret,
        },
      },
      secret,
    );
    expect(ip).toBe('203.0.113.7');
  });

  it('ignores a forwarded IP without the right secret', () => {
    const headers = { [CLIENT_IP_HEADER]: '203.0.113.7' };
    expect(clientIp({ ip: '10.0.0.1', headers }, secret)).toBe('10.0.0.1');
    expect(
      clientIp(
        {
          ip: '10.0.0.1',
          headers: { ...headers, [PROXY_SECRET_HEADER]: 'wrong' },
        },
        secret,
      ),
    ).toBe('10.0.0.1');
  });

  it('never trusts the header while no secret is configured', () => {
    const ip = clientIp(
      {
        ip: '10.0.0.1',
        headers: {
          [CLIENT_IP_HEADER]: '203.0.113.7',
          [PROXY_SECRET_HEADER]: '',
        },
      },
      '',
    );
    expect(ip).toBe('10.0.0.1');
  });
});
