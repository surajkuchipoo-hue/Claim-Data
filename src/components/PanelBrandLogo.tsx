import { useId } from 'react';

interface PanelBrandLogoProps {
  panelName: string;
  size?: number;
}

export function PanelBrandLogo({
  panelName,
  size = 26,
}: PanelBrandLogoProps) {
  const uid = useId();
  const key = panelName.trim().toLowerCase();

  if (key === 'ajio') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="32" height="32" rx="7" fill="#2C4152" />
        <text
          x="16"
          y="19.5"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="9.5"
          fontWeight="800"
          fontFamily="Inter, system-ui, sans-serif"
          letterSpacing="0.8"
        >
          AJIO
        </text>
      </svg>
    );
  }

  if (key === 'meesho') {
    const gradId = `meeshoGrad-${uid}`;
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="#F43397" />
            <stop offset="100%" stopColor="#570D48" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="7" fill={`url(#${gradId})`} />
        <path
          d="M7.5 21.5V13.2C7.5 11.4 9.1 10.3 10.7 10.8C12 11.2 12.8 12.4 12.8 13.8V21.5M12.8 14.2C12.8 12.1 14.5 10.6 16.4 10.6C18.3 10.6 19.6 12.1 19.6 14.2V21.5M19.6 14.2C19.6 12.1 21.1 10.6 22.9 10.6C24.2 10.6 24.8 11.5 24.8 13V21.5"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (key === 'firstcry') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="32" height="32" rx="7" fill="#00AEEF" />
        <circle cx="16" cy="15" r="8.5" fill="#FFC20E" />
        <path
          d="M12.3 13.8C12.3 13.2 12.8 12.7 13.4 12.7C14 12.7 14.5 13.2 14.5 13.8M17.5 13.8C17.5 13.2 18 12.7 18.6 12.7C19.2 12.7 19.7 13.2 19.7 13.8"
          stroke="#1E293B"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M12.6 17C13.5 18.6 14.7 19.2 16 19.2C17.3 19.2 18.5 18.6 19.4 17"
          stroke="#E11D48"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (key === 'snapdeal') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="32" height="32" rx="7" fill="#E40046" />
        <path
          d="M21 10.5C19.8 9.4 18 8.8 16 8.8C12.9 8.8 10.8 10.5 10.8 12.8C10.8 15.2 13 16.1 16.1 16.8C19.1 17.4 21.2 18.2 21.2 20.4C21.2 22.6 19 24.2 15.8 24.2C13.6 24.2 11.7 23.4 10.4 22"
          stroke="#FFFFFF"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (key === 'nykaa') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="32" height="32" rx="7" fill="#FC2779" />
        <path
          d="M10.5 22.5V9.5L21.5 22.5V9.5"
          stroke="#FFFFFF"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (key === 'myntra') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect
          width="32"
          height="32"
          rx="7"
          fill="#FFF1F5"
          stroke="#FBCFE8"
          strokeWidth="1"
        />
        <path
          d="M7 22L10.2 10.5L14 17.5"
          stroke="#F26A10"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12.5 22L16 11.5L19.5 22"
          stroke="#FF3F6C"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M18 17.5L21.8 10.5L25 22"
          stroke="#E72744"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (key === 'flipkart') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="32" height="32" rx="7" fill="#2874F0" />
        <path
          d="M9 11.5H23L21.6 24.5C21.5 25.3 20.8 26 20 26H12C11.2 26 10.5 25.3 10.4 24.5L9 11.5Z"
          fill="#FFE500"
        />
        <path
          d="M12.5 11.5V9.5C12.5 7.6 14.1 6 16 6C17.9 6 19.5 7.6 19.5 9.5V11.5"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M17.8 14.5H16.4C15.6 14.5 15.2 15 15.2 15.8V23M13.5 18.2H17.6"
          stroke="#2874F0"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (key === 'amazon') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="32" height="32" rx="7" fill="#232F3E" />
        <text
          x="16"
          y="18.2"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="15.5"
          fontWeight="800"
          fontFamily="Inter, system-ui, sans-serif"
        >
          a
        </text>
        <path
          d="M8.5 22.5C12.5 25.2 18.8 25.2 23 22.2"
          stroke="#FF9900"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <path
          d="M21 21.6L23.5 22L22.5 24.5"
          stroke="#FF9900"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (key === 'shopify') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="32" height="32" rx="7" fill="#95BF47" />
        <path
          d="M9.5 10.5L22.5 9.8L24 24.5L8 24.5L9.5 10.5Z"
          fill="#5E8E3E"
        />
        <path
          d="M12.8 10.3V8.8C12.8 7.2 14.2 6 15.8 6C17.4 6 18.8 7.2 18.8 8.8V10.1"
          stroke="#FFFFFF"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
        <path
          d="M18.4 14.3C17.6 13.7 16.6 13.5 15.6 13.6C14.3 13.7 13.5 14.4 13.5 15.4C13.5 16.5 14.6 16.9 16 17.3C17.5 17.7 18.5 18.3 18.5 19.6C18.5 21 17.3 21.9 15.6 21.9C14.3 21.9 13.3 21.5 12.6 20.9"
          stroke="#FFFFFF"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (key === 'cred') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="32" height="32" rx="7" fill="#111111" />
        <path
          d="M9 8.5H23V17.2C23 21.1 19.9 23.8 16 25C12.1 23.8 9 21.1 9 17.2V8.5Z"
          stroke="#FFFFFF"
          strokeWidth="1.8"
        />
        <path
          d="M13 12.5H19V16.8C19 18.7 17.6 20.1 16 20.7C14.4 20.1 13 18.7 13 16.8V12.5Z"
          stroke="#FFFFFF"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  const initial = (panelName.trim()[0] || 'P').toUpperCase();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="32" height="32" rx="7" fill="#1E40AF" />
      <text
        x="16"
        y="20.5"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="14"
        fontWeight="700"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {initial}
      </text>
    </svg>
  );
}
