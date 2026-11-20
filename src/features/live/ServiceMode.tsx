import { createContext, useContext } from 'react';
export const ServiceMode = createContext(false);
export const useLiveService = () => useContext(ServiceMode);
