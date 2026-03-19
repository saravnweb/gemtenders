"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Script from "next/script";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    google: any;
  }
}

export default function GoogleOneTap() {
  const router = useRouter();
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const initialized = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Suppress benign Google Identity Services FedCM logs that clutter the console and Next.js error overlay
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const originalConsoleError = console.error;
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;

    const filterLog = (originalMethod: any, ...args: any[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : (args[0]?.message || String(args[0] || ''));
      if (
        msg.includes('[GSI_LOGGER]:') || 
        msg.includes('FedCM get() rejects with AbortError') || 
        msg.includes('stop functioning when FedCM becomes mandatory') ||
        msg.includes('The request has been aborted')
      ) {
        return;
      }
      originalMethod(...args);
    };

    console.error = (...args) => filterLog(originalConsoleError, ...args);
    console.log = (...args) => filterLog(originalConsoleLog, ...args);
    console.warn = (...args) => filterLog(originalConsoleWarn, ...args);

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = typeof reason === 'string' ? reason : (reason?.message || String(reason || ''));
      if (
        msg.includes('[GSI_LOGGER]:') || 
        msg.includes('FedCM get() rejects with AbortError') || 
        msg.includes('signal is aborted without reason') ||
        msg.includes('The request has been aborted')
      ) {
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      console.error = originalConsoleError;
      console.log = originalConsoleLog;
      console.warn = originalConsoleWarn;
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (!isScriptLoaded || typeof window === "undefined" || !window.google) return;
    
    // Clear the timeout if component remounts quickly (React Strict Mode)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (initialized.current) return;
    
    let isCancelled = false;

    const initializeOneTap = async () => {
      // 1. Only run this for unauthenticated users
      const { data: { session } } = await supabase.auth.getSession();
      if (session || isCancelled) return;

      const clientID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      
      if (!clientID) {
        console.warn(">>> [GOOGLE ONE TAP] Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID in env variables.");
        return;
      }

      // Generate hash for nonce
      const generateNonce = async () => {
        const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        
        const encoder = new TextEncoder();
        const encodedNonce = encoder.encode(nonce);
        const hashBuffer = await crypto.subtle.digest('SHA-256', encodedNonce);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashedNonce = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return { nonce, hashedNonce };
      };

      const { nonce, hashedNonce } = await generateNonce();

      if (isCancelled) return;
      initialized.current = true;

      // 2. Initialize the Google One Tap ID
      window.google.accounts.id.initialize({
        client_id: clientID,
        nonce: hashedNonce,
        use_fedcm_for_prompt: true,
        callback: async (response: any) => {
          console.log(">>> [GOOGLE ONE TAP] Received credential");
          
          // 3. Send the ID token to Supabase
          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: response.credential,
            nonce: nonce,
          });

          if (data && !error) {
            console.log(">>> [GOOGLE ONE TAP] Successfully signed in");
            router.refresh();
          }
          
          if (error) {
            console.error(">>> [GOOGLE ONE TAP] Supabase Auth Error:", error.message);
          }
        },
        auto_select: false, // Set to true for automatic sign-in if the user has only one account
        cancel_on_tap_outside: true,
      });

      // 4. Show the One Tap prompt
      window.google.accounts.id.prompt();
    };

    initializeOneTap();

    return () => {
      isCancelled = true;
      // Debounce the cancel action to prevent AbortError in React Strict Mode
      timeoutRef.current = setTimeout(() => {
        if (initialized.current && typeof window !== 'undefined' && window.google) {
          window.google.accounts.id.cancel();
          initialized.current = false;
        }
      }, 500);
    };
  }, [isScriptLoaded, router]);

  return (
    <Script
      src="https://accounts.google.com/gsi/client"
      onLoad={() => setIsScriptLoaded(true)}
      strategy="afterInteractive"
    />
  );
}
