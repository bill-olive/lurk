"use client";

import { useState, useRef, useEffect } from "react";
import { clsx } from "clsx";
import {
  ChevronDown,
  Settings,
  LogOut,
  User,
  Bell,
  Building2,
  Check,
} from "lucide-react";
import { useAuth, useOrg } from "@/lib/hooks";

export function Header() {
  const { user, signOut } = useAuth();
  const { currentOrg, orgs, switchOrg } = useOrg();
  const [showOrgMenu, setShowOrgMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const orgRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (orgRef.current && !orgRef.current.contains(e.target as Node)) {
        setShowOrgMenu(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="h-14 bg-white/80 backdrop-blur-xl border-b border-ink-100 flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Left: Org Switcher */}
      <div ref={orgRef} className="relative">
        <button
          onClick={() => setShowOrgMenu(!showOrgMenu)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-ink-50 transition-colors"
        >
          <div className="w-6 h-6 rounded-md bg-clay-100 flex items-center justify-center">
            <Building2 className="w-3.5 h-3.5 text-clay-500" />
          </div>
          <span className="text-body-sm font-medium text-ink-700">
            {currentOrg?.name || "Select Organization"}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-ink-300" />
        </button>

        {showOrgMenu && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-ink-100 rounded-editorial shadow-warm-lg py-1 animate-slide-in">
            <div className="px-3 py-2 border-b border-ink-100">
              <span className="text-2xs font-medium text-ink-300 uppercase tracking-wider">
                Organizations
              </span>
            </div>
            {orgs.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  switchOrg(org.id);
                  setShowOrgMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-ink-50 transition-colors"
              >
                <div className="w-7 h-7 rounded-md bg-clay-100 flex items-center justify-center">
                  <Building2 className="w-3.5 h-3.5 text-clay-500" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-body-sm text-ink-700">{org.name}</div>
                  <div className="text-2xs text-ink-300">
                    {org.memberCount} members · {org.plan}
                  </div>
                </div>
                {currentOrg?.id === org.id && (
                  <Check className="w-4 h-4 text-clay-500" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button className="relative p-2 rounded-lg hover:bg-ink-50 text-ink-400 hover:text-ink-600 transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-clay-500 rounded-full" />
        </button>

        <div ref={userRef} className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-ink-50 transition-colors"
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="w-7 h-7 rounded-full border border-ink-100"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-ink-100 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-ink-400" />
              </div>
            )}
            <div className="hidden sm:block text-left">
              <div className="text-body-sm font-medium text-ink-700">
                {user?.displayName || "Admin User"}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-ink-300" />
          </button>

          {showUserMenu && (
            <div className="absolute top-full right-0 mt-1 w-56 bg-white border border-ink-100 rounded-editorial shadow-warm-lg py-1 animate-slide-in">
              <div className="px-3 py-2.5 border-b border-ink-100">
                <div className="text-body-sm font-medium text-ink-700">
                  {user?.displayName || "Admin User"}
                </div>
                <div className="text-2xs text-ink-300">
                  {user?.email || "admin@lurk.dev"}
                </div>
              </div>
              <button className="w-full flex items-center gap-2.5 px-3 py-2 text-body-sm text-ink-400 hover:text-ink-700 hover:bg-ink-50 transition-colors">
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <div className="border-t border-ink-100 mt-1 pt-1">
                <button
                  onClick={() => {
                    signOut();
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-body-sm text-accent-red hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
