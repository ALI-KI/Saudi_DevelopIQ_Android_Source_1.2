import { createRoot } from 'react-dom/client';
import { installMobileBridge } from './platform';
import { MobileApp } from './MobileApp';
import './mobile.css';

// Install the native storage/export API before Zustand hydrates the first study.
installMobileBridge();
createRoot(document.getElementById('root')!).render(<MobileApp />);
