const PATHS = {
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  restart: 'M3 12a9 9 0 1 0 2.64-6.36M3 3.5V9h5.5',
  prev: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  soundOn: 'M4 9v6h4l5 4V5L8 9H4ZM16.5 8.5a5 5 0 0 1 0 7M19.5 5.5a9 9 0 0 1 0 13',
  soundOff: 'M4 9v6h4l5 4V5L8 9H4ZM17 9.5l5 5M22 9.5l-5 5',
  boards: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  close: 'M6 6l12 12M18 6 6 18',
  chevrons: 'M5 5l6 7-6 7M12 5l6 7-6 7',
};

export type IconName = keyof typeof PATHS;

export const Icon = ({ name, size = 20 }: { name: IconName; size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={PATHS[name]} />
  </svg>
);
