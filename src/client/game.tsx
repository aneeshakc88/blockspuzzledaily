import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PlayScreen } from './slideblock/PlayScreen';

export const App = () => <PlayScreen />;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
