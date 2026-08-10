import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  split,
  from,
} from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import { setContext } from '@apollo/client/link/context';

const NHOST_SUBDOMAIN = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || 'local';
const NHOST_REGION = process.env.NEXT_PUBLIC_NHOST_REGION || '';

const GRAPHQL_HTTP_URL =
  NHOST_REGION
    ? `https://${NHOST_SUBDOMAIN}.hasura.${NHOST_REGION}.nhost.run/v1/graphql`
    : 'http://localhost:8080/v1/graphql';

const GRAPHQL_WS_URL =
  NHOST_REGION
    ? `wss://${NHOST_SUBDOMAIN}.hasura.${NHOST_REGION}.nhost.run/v1/graphql`
    : 'ws://localhost:8080/v1/graphql';

export function createApolloClient(accessToken: string | null) {
  const authLink = setContext((_, { headers }) => ({
    headers: {
      ...headers,
      ...(accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : { 'x-hasura-admin-secret': 'nhost-admin-secret' }),
    },
  }));

  const httpLink = new HttpLink({ uri: GRAPHQL_HTTP_URL });

  const wsLink =
    typeof window !== 'undefined'
      ? new GraphQLWsLink(
          createClient({
            url: GRAPHQL_WS_URL,
            connectionParams: () => ({
              headers: accessToken
                ? { Authorization: `Bearer ${accessToken}` }
                : { 'x-hasura-admin-secret': 'nhost-admin-secret' },
            }),
          })
        )
      : null;

  const splitLink = wsLink
    ? split(
        ({ query }) => {
          const definition = getMainDefinition(query);
          return (
            definition.kind === 'OperationDefinition' &&
            definition.operation === 'subscription'
          );
        },
        wsLink,
        from([authLink, httpLink])
      )
    : from([authLink, httpLink]);

  return new ApolloClient({
    link: splitLink,
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: { fetchPolicy: 'cache-and-network' },
    },
  });
}
