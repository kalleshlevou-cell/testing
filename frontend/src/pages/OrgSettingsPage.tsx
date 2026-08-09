import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useOrg } from '../context/OrgContext';
import { GET_ORG_MEMBERS, ADD_ORG_MEMBER } from '../lib/graphql';
import { OrgRole } from '../types';
import { Users, Plus, Loader } from 'lucide-react';

export const OrgSettingsPage = () => {
  const { currentOrg, myRole } = useOrg();
  const isOwner = myRole === 'owner';
  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState<OrgRole>('editor');
  const [error, setError] = useState('');

  const { data, loading, refetch } = useQuery(GET_ORG_MEMBERS, {
    variables: { org_id: currentOrg?.organization.id },
    skip: !currentOrg,
  });

  const [addMember, { loading: adding }] = useMutation(ADD_ORG_MEMBER, {
    onCompleted: () => {
      setNewUserId('');
      refetch();
    },
    onError: (err) => setError(err.message),
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!currentOrg || !newUserId.trim()) return;
    addMember({
      variables: {
        org_id: currentOrg.organization.id,
        user_id: newUserId.trim(),
        role: newRole,
      },
    });
  };

  if (!currentOrg) return null;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Organization Settings</h1>
          <p className="page-subtitle">{currentOrg.organization.name}</p>
        </div>
      </div>

      {/* Quota */}
      <div className="settings-section">
        <h2 className="section-title">Usage Quota</h2>
        <div className="quota-detail">
          <div className="quota-row">
            <span>Calls used this period</span>
            <strong>{currentOrg.organization.quota_calls_used}</strong>
          </div>
          <div className="quota-row">
            <span>Calls allowed</span>
            <strong>{currentOrg.organization.quota_calls_allowed}</strong>
          </div>
          <div className="quota-bar-large">
            <div
              className="quota-bar-fill-large"
              style={{
                width: `${Math.min(
                  (currentOrg.organization.quota_calls_used /
                    currentOrg.organization.quota_calls_allowed) *
                    100,
                  100
                )}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="settings-section">
        <h2 className="section-title">
          <Users size={16} /> Members
        </h2>

        {loading ? (
          <Loader size={20} className="spin" />
        ) : (
          <table className="members-table" aria-label="Organization members">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {data?.org_members?.map(
                (m: { id: string; user_id: string; role: OrgRole; created_at: string }) => (
                  <tr key={m.id}>
                    <td className="monospace">{m.user_id}</td>
                    <td>
                      <span className={`role-badge role-${m.role}`}>{m.role}</span>
                    </td>
                    <td>{new Date(m.created_at).toLocaleDateString()}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}

        {isOwner && (
          <form onSubmit={handleAdd} className="add-member-form">
            <h3 className="subsection-title">Add Member</h3>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-row">
              <input
                className="form-input"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                placeholder="User UUID"
                required
              />
              <select
                className="form-select"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as OrgRole)}
              >
                <option value="owner">owner</option>
                <option value="editor">editor</option>
                <option value="viewer">viewer</option>
              </select>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={adding}
              >
                <Plus size={14} />
                {adding ? 'Adding...' : 'Add'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
