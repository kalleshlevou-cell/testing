import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  split,
} from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { setContext } from '@apollo/client/link/context';
import { nhost } from './nhost';

const isLocal = process.env.REACT_APP_NHOST_SUBDOMAIN === 'local';

const GRAPHQL_HTTP = isLocal
  ? 'http://localhost:1337/v1/graphql'
  : `https://${process.env.REACT_APP_NHOST_SUBDOMAIN}.hasura.${process.env.REACT_APP_NHOST_REGION}.nhost.run/v1/graphql`;

const GRAPHQL_WS = GRAPHQL_HTTP.replace(/^http/, 'ws');

const authLink = setContext(async (_, { headers }) => {
  const token = nhost.auth.getAccessToken();
  return {
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
});

const httpLink = new HttpLink({ uri: GRAPHQL_HTTP });

const wsLink = new GraphQLWsLink(
  createClient({
    url: GRAPHQL_WS,
    connectionParams: () => {
      const token = nhost.auth.getAccessToken();
      return token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : {};
    },
  })
);

const splitLink = split(
  ({ query }) => {
    const def = getMainDefinition(query);
    return def.kind === 'OperationDefinition' && def.operation === 'subscription';
  },
  wsLink,
  authLink.concat(httpLink)
);

export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});
