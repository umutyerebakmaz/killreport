"use client";

import Loader from "@/components/Loader";
import { ApolloProvider } from "@apollo/client";
import { useEffect, useState } from "react";
import { createApolloClient } from "../lib/apolloClient";

export default function ApolloWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  // Create Apollo Client only on client-side after mount
  const [apolloClient, setApolloClient] = useState<ReturnType<
    typeof createApolloClient
  > | null>(null);

  useEffect(() => {
    // This only runs in the browser
    const client = createApolloClient();
    setApolloClient(client);
  }, []);

  // Don't render until client is ready
  if (!apolloClient) {
    return <Loader size="lg" text="Initializing..." fullHeight />;
  }

  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>;
}
