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
    
/*
    const originalConsoleError = console.error;
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;

    const filterLog = (originalMethod: any, ...args: any[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : (args[0]?.message || String(args[0] || ''));
      if (
        msg.includes('[GSI_LOGGER]:') || 
        msg.includes('FedCM get() rejects with AbortError') || 
        msg.includes('stop functioning when FedCM becomes mandatory') ||
        msg.includes('The request has been aborted') ||
        msg.includes('FedCM was disabled') ||
        msg.includes('gsi/status')
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
        msg.includes('The request has been aborted') ||
        msg.includes('FedCM was disabled') ||
        msg.includes('gsi/status')
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
    */
   return;
  }, []);

  useEffect(() => {
    console.log(">>> [GOOGLE ONE TAP] useEffect triggered. scriptLoaded:", isScriptLoaded, "google available:", !!window.google);
    if (!isScriptLoaded || typeof window === "undefined" || !window.google) return;
    
    // Clear the timeout if component remounts quickly (React Strict Mode)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    initialized.current = true;
    let isCancelled = false;

    const initializeOneTap = async () => {
      console.log(">>> [GOOGLE ONE TAP] Starting initializeOneTap...");
      // 1. Only run this for unauthenticated users
      const { data: { session } } = await supabase.auth.getSession();
      if (session || isCancelled) {
        if (session) {
          console.log(">>> [GOOGLE ONE TAP] User already has a session, skipping One Tap.");
          initialized.current = true; 
        }
        else {
          console.log(">>> [GOOGLE ONE TAP] Initialization cancelled, skipping.");
          initialized.current = false;
        }
        return;
      }

      const clientID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      
      if (!clientID) {
        console.warn(">>> [GOOGLE ONE TAP] Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID in env variables.");
        return;
      }

      console.log(">>> [GOOGLE ONE TAP] Client ID found, generating nonce...");

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

      console.log(">>> [GOOGLE ONE TAP] Nonce generated, initializing window.google.accounts.id...");

      // 2. Initialize the Google One Tap ID
      window.google.accounts.id.initialize({
        client_id: clientID,
        nonce: hashedNonce,
        use_fedcm_for_prompt: false, // Changed from true to false for better reliability/compatibility
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

      console.log(">>> [GOOGLE ONE TAP] Calling window.google.accounts.id.prompt()...");

      // 4. Show the One Tap prompt
      window.google.accounts.id.prompt((notification: any) => {
        const reason = notification.getNotDisplayedReason?.() || notification.getSkippedReason?.() || notification.getDismissedReason?.() || "Unknown reason";
        
        if (notification.isNotDisplayed()) {
          console.warn(">>> [GOOGLE ONE TAP] Prompt NOT displayed:", reason);
          if (reason === 'suppressed_by_user') {
            console.warn(">>> [GOOGLE ONE TAP] HINT: User has manually dismissed this prompt recently.");
          } else if (reason === 'opt_out_or_no_session') {
            console.warn(">>> [GOOGLE ONE TAP] HINT: User is not signed in to a Google account or has opted out.");
          }
        } else if (notification.isSkippedMoment()) {
          console.warn(">>> [GOOGLE ONE TAP] Prompt skipped moment:", reason);
        } else if (notification.isDismissedMoment()) {
          console.warn(">>> [GOOGLE ONE TAP] Prompt dismissed moment:", reason);
        } else {
          console.log(">>> [GOOGLE ONE TAP] Prompt displayed successfully");
        }
      });
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
