"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setIsSupported(false);
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-IN"; // English (India) with Hindi term recognition

      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          onTranscript(transcript);
        }
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.warn("[VoiceInput] Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [onTranscript]);

  const toggleListening = () => {
    if (!isSupported) {
      alert("Voice input is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.error("[VoiceInput] Could not start speech recognition:", err);
        setIsListening(false);
      }
    }
  };

  return (
    <button
      type="button"
      onClick={toggleListening}
      disabled={disabled || !isSupported}
      title={
        !isSupported
          ? "Speech recognition not supported in this browser"
          : isListening
          ? "Listening... Click to stop"
          : "Click to speak"
      }
      className={cn(
        "grid size-7 place-items-center rounded-lg transition-all focus:outline-none focus:ring-1 focus:ring-[#E05638]",
        isListening
          ? "bg-red-500 text-white animate-pulse"
          : "bg-[#EFECE6] text-[#5F6368] hover:bg-[#D8D5CE] hover:text-[#1A1D20]",
        (!isSupported || disabled) && "opacity-40 cursor-not-allowed"
      )}
    >
      {isListening ? <MicOff size={14} /> : <Mic size={14} />}
    </button>
  );
}
