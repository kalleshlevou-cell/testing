import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSignOut, useUserEmail } from '@nhost/react';
import { useOrg } from '../context/OrgContext';
import { LogOut, Workflow, ChevronDown, Settings } from 'lucide-react';

export const Navbar = () => {
  const { signOut } = useSignOut();
  const email = useUserEmail();
  const navigate = useNavigate();
  const { orgs, currentOrg, setCurrentOrg } = useOrg();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Workflow size={20} />
        <Link to="/" className="navbar-title">WorkflowAI</Link>
      </div>

      <div className="navbar-center">
        {orgs.length > 0 && (
          <div className="org-switcher">
            <span className="org-label">Org:</span>
            <div className="org-select-wrapper">
              <select
                value={currentOrg?.organization.id ?? ''}
                onChange={(e) => {
                  const selected = orgs.find(
                    (o) => o.organization.id === e.target.value
                  );
                  if (selected) setCurrentOrg(selected);
                }}
                className="org-select"
              >
                {orgs.map((o) => (
                  <option key={o.organization.id} value={o.organization.id}>
                    {o.organization.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="select-icon" />
            </div>
            {currentOrg && (
              <span className={`role-badge role-${currentOrg.role}`}>
                {currentOrg.role}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="navbar-right">
        {currentOrg && (
          <div className="quota-pill">
            <span>
              {currentOrg.organization.quota_calls_used} /{' '}
              {currentOrg.organization.quota_calls_allowed} calls
            </span>
          </div>
        )}
        <span className="user-email">{email}</span>
        <Link to="/settings" className="btn btn-ghost btn-sm" aria-label="Settings">
          <Settings size={16} />
        </Link>
        <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </nav>
  );
};
