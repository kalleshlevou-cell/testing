import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from 'react';
import { useQuery } from '@apollo/client';
import { useAuthenticationStatus, useUserId } from '@nhost/react';
import { GET_MY_ORGS } from '../lib/graphql';
import { OrgContext as OrgCtxType, OrgRole, Organization } from '../types';

interface OrgContextValue {
  orgs: OrgCtxType[];
  currentOrg: OrgCtxType | null;
  setCurrentOrg: (org: OrgCtxType) => void;
  loading: boolean;
  myRole: OrgRole | null;
}

const OrgContext = createContext<OrgContextValue>({
  orgs: [],
  currentOrg: null,
  setCurrentOrg: () => {},
  loading: true,
  myRole: null,
});

export const OrgProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuthenticationStatus();
  const userId = useUserId();
  const [currentOrg, setCurrentOrg] = useState<OrgCtxType | null>(null);

  const { data, loading } = useQuery(GET_MY_ORGS, {
    skip: !isAuthenticated || !userId,
    fetchPolicy: 'cache-and-network',
  });

  const orgs: OrgCtxType[] = useMemo(
    () =>
      data?.org_members?.map((m: {
        role: OrgRole;
        organization: Organization;
      }) => ({
        role: m.role,
        organization: m.organization,
      })) ?? [],
    [data]
  );

  // Auto-select first org
  useEffect(() => {
    if (orgs.length > 0 && !currentOrg) {
      setCurrentOrg(orgs[0]);
    }
  }, [orgs, currentOrg]);

  return (
    <OrgContext.Provider
      value={{
        orgs,
        currentOrg,
        setCurrentOrg,
        loading,
        myRole: currentOrg?.role ?? null,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
};

export const useOrg = () => useContext(OrgContext);
