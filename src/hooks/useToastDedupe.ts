import { useRef, useCallback } from 'react';
import { toast, Id } from 'react-toastify';

/**
 * Custom hook for toast deduplication
 * Prevents duplicate toasts with the same message and type
 */
export const useToastDedupe = () => {
  const activeToastIds = useRef<Map<string, Id>>(new Map());
  
  const showToast = useCallback((
    type: 'success' | 'error' | 'warning' | 'info',
    message: string,
    options?: {
      unique?: boolean;
      autoClose?: number;
      onClose?: () => void;
      [key: string]: any;
    }
  ) => {
    // Generate unique key from message + type
    const key = `${type}-${message}`;
    
    // Check if already showing
    const existingId = activeToastIds.current.get(key);
    if (existingId && toast.isActive(existingId)) {
      return existingId; // Return existing toast ID, don't create duplicate
    }
    
    // Clear any existing toast of same type if options.unique is true
    if (options?.unique) {
      activeToastIds.current.forEach((id, k) => {
        if (k.startsWith(`${type}-`)) {
          toast.dismiss(id);
          activeToastIds.current.delete(k);
        }
      });
    }
    
    // Show new toast
    const id = toast[type](message, {
      ...options,
      onClose: () => {
        activeToastIds.current.delete(key); // Clean up on close
        if (options?.onClose) {
          options.onClose();
        }
      }
    });
    
    // Track active toast
    activeToastIds.current.set(key, id);
    
    return id;
  }, []);
  
  // Clear all toasts
  const clearAll = useCallback(() => {
    activeToastIds.current.forEach((id) => {
      toast.dismiss(id);
    });
    activeToastIds.current.clear();
  }, []);
  
  return { showToast, clearAll };
};

