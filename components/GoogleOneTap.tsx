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

  useEffect(() => {
    if (!isScriptLoaded || typeof window === "undefined" || !window.google) return;
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
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed()) {
          console.log(">>> [GOOGLE ONE TAP] Not displayed:", notification.getNotDisplayedReason());
        } else if (notification.isSkippedMoment()) {
           console.log(">>> [GOOGLE ONE TAP] Skipped:", notification.getSkippedReason());
        } else if (notification.isDismissedMoment()) {
           console.log(">>> [GOOGLE ONE TAP] Dismissed:", notification.getDismissedReason());
        }
      });
    };

    initializeOneTap();

    return () => {
      isCancelled = true;
      if (initialized.current && typeof window !== 'undefined' && window.google) {
        window.google.accounts.id.cancel();
        initialized.current = false;
      }
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
