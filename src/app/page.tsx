"use client";

import {
  getKeyByValue,
  LanguageEnum,
  languageOptions,
} from "@/enums/LanguageEnum";
import React, { useEffect, useRef, useState } from "react";

export default function Home() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const [korean, setKorean] = useState<string>();
  const [selectedLanguage, setSelectedLanguage] = useState<
    | "ENGLISH"
    | "JAPANESE"
    | "SIMPLIFIED_CHINESE"
    | "TRADITIONAL_CHINESE"
    | "VIETNAMESE"
    | "THAI"
    | "INDONESIAN"
    | "FRENCH"
    | "SPANISH"
    | "RUSSIAN"
    | "GERMAN"
    | "ITALIAN"
  >("ENGLISH");
  const [targetText, setTargetText] = useState<string>();

  console.log(languageOptions);

  const options = languageOptions.map((value) => (
    <option key={value} value={value}>
      {value}
    </option>
  ));

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedLanguage(e.target.value as typeof selectedLanguage);
  };

  useEffect(() => {
    const startRecording = async () => {
      if (navigator.mediaDevices === undefined) {
        alert("연결된 마이크를 찾을 수 없습니다.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      await audioContext.audioWorklet.addModule("/process.js");

      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, "audio-processor");
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = async (event) => {
        console.log("Speaking");

        const response = await fetch(`/proto?lang=${selectedLanguage}`, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: event.data.buffer,
        });

        const body = await response.json();

        setKorean(body.korean);
        setTargetText(body.target_text);
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);
    };

    startRecording();

    return () => {
      workletNodeRef.current?.disconnect();
      audioContextRef.current?.close();
    };
  }, [selectedLanguage]);

  return (
    <div className="h-screen grid">
      <div className="m-auto">
        <div className="text-black bg-white py-1 px-4 rounded-2xl">
          <select
            id="language-select"
            value={selectedLanguage}
            onChange={handleChange}
          >
            {options}
          </select>
        </div>
        <p className="font-bold text-xl">{korean}</p>
        <p className="font-bold text-xl">{targetText}</p>
      </div>
    </div>
  );
}
