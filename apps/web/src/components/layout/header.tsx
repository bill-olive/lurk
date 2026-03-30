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
    <header className="h-14 bg-surface-50/80 backdrop-blur-xl border-b border-gray-800/60 flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Left: Org Switcher */}
      <div ref={orgRef} className="relative">
        <button
          onClick={() => setShowOrgMenu(!showOrgMenu)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface-200 transition-colors"
        >
          <div className="w-6 h-6 rounded-md bg-lurk-600/20 flex items-center justify-center">
            <Building2 className="w-3.5 h-3.5 text-lurk-400" />
          </div>
          <span className="text-sm font-medium text-gray-200">
            {currentOrg?.name || "Select Organization"}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
        </button>

        {showOrgMenu && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-surface-100 border border-gray-800/60 rounded-xl shadow-2xl py-1 animate-slide-in">
            <div className="px-3 py-2 border-b border-gray-800/60">
              <span className="text-2xs font-medium text-gray-500 uppercase tracking-wider">
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
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-200 transition-colors"
              >
                <div className="w-7 h-7 rounded-md bg-lurk-600/20 flex items-center justify-center">
                  <Building2 className="w-3.5 h-3.5 text-lurk-400" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm text-gray-200">{org.name}</div>
                  <div className="text-2xs text-gray-500">
                    {org.memberCount} members &middot; {org.plan}
                  </div>
                </div>
                {currentOrg?.id === org.id && (
                  <Check className="w-4 h-4 text-lurk-400" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-surface-200 text-gray-400 hover:text-gray-200 transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-lurk-500 rounded-full" />
        </button>

        {/* User Menu */}
        <div ref={userRef} className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-200 transition-colors"
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="w-7 h-7 rounded-full border border-gray-700"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-surface-300 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-gray-400" />
              </div>
            )}
            <div className="hidden sm:block text-left">
              <div className="text-sm font-medium text-gray-200">
                {user?.displayName || "Admin User"}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          </button>

          {showUserMenu && (
            <div className="absolute top-full right-0 mt-1 w-56 bg-surface-100 border border-gray-800/60 rounded-xl shadow-2xl py-1 animate-slide-in">
              <div className="px-3 py-2.5 border-b border-gray-800/60">
                <div className="text-sm font-medium text-gray-200">
                  {user?.displayName || "Admin User"}
                </div>
                <div className="text-2xs text-gray-500">
                  {user?.email || "admin@lurk.dev"}
                </div>
              </div>
              <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-surface-200 transition-colors">
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <div className="border-t border-gray-800/60 mt-1 pt-1">
                <button
                  onClick={() => {
                    signOut();
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
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
