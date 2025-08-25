import React from "react";

type IconProps = { className?: string; title?: string };

export const IconLobby: React.FC<IconProps> = ({
  className = "w-4 h-4",
  title = "Lobby",
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden={!title}
    role="img"
  >
    {title ? <title>{title}</title> : null}
    <path
      d="M3 10.5L12 3l9 7.5"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5 10v9h14v-9"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10 19v-5h4v5"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconJoin: React.FC<IconProps> = ({
  className = "w-4 h-4",
  title = "Join Room",
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden={!title}
    role="img"
  >
    {title ? <title>{title}</title> : null}
    <path
      d="M14 5h5v14h-5"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 12h9"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
    <path
      d="M9.5 9.5L12 12l-2.5 2.5"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconCreate: React.FC<IconProps> = ({
  className = "w-4 h-4",
  title = "Create Room",
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden={!title}
    role="img"
  >
    {title ? <title>{title}</title> : null}
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth={2} />
    <path
      d="M12 8v8M8 12h8"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
  </svg>
);

export const IconLeave: React.FC<IconProps> = ({
  className = "w-4 h-4",
  title = "Leave Room",
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden={!title}
    role="img"
  >
    {title ? <title>{title}</title> : null}
    <path
      d="M10 5H5v14h5"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M21 12H10"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
    <path
      d="M12.5 9.5L10 12l2.5 2.5"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconLogout: React.FC<IconProps> = ({
  className = "w-4 h-4",
  title = "Logout",
}) => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
);
