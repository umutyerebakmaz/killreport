"use client";

import { ApolloProvider } from "@apollo/client";
import { useMemo } from "react";
import { createApolloClient } from "../lib/apolloClient";

export default function ApolloWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  // Create Apollo Client once using useMemo instead of useState + useEffect
  // This reduces the initialization delay
  const apolloClient = useMemo(() => createApolloClient(), []);

  // Client is ready immediately, no loading state needed
  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>;
}
