import { GET_MY_ORGS } from './graphql';

describe('GET_MY_ORGS', () => {
  it('uses the authenticated user id as a query variable', () => {
    const source = GET_MY_ORGS.loc?.source.body ?? '';

    expect(source).toContain('$user_id');
    expect(source).toContain('user_id: { _eq: $user_id }');
  });
});
