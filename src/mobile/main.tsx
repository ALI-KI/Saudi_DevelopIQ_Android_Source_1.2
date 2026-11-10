import { createRoot } from 'react-dom/client';
import { installMobileBridge } from './platform';
import { MobileApp } from './MobileApp';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import './mobile.css';

// Install the native storage/export API before Zustand hydrates the first study.
installMobileBridge();
createRoot(document.getElementById('root')!).render(<MobileApp />);
