"use client";

import { LanguageEnum } from "@/enums/LanguageEnum";
import React, { useEffect, useRef, useState } from "react";

function toEnum(value: string): LanguageEnum | undefined {
  if (value in LanguageEnum) {
    return LanguageEnum[value as keyof typeof LanguageEnum];
  }
  return undefined;
}

export default function Home() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const [korean, setKorean] = useState<string>();
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageEnum>(
    LanguageEnum.ENGLISH
  );
  const [targetText, setTargetText] = useState<string>();

  const languageOptions = Object.entries(LanguageEnum)
    .filter(([key, value]) => typeof value === "number")
    .map(([key, value]) => (
      <option key={value} value={value}>
        {key}
      </option>
    ));

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    console.log("Selected language:", e.target.value);
    setSelectedLanguage(toEnum(e.target.value) ?? LanguageEnum.ENGLISH);
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
        console.log(body);

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
      <div>
        <label htmlFor="language-select">Choose a language:</label>
        <select
          id="language-select"
          value={selectedLanguage}
          onChange={handleChange}
        >
          {languageOptions}
        </select>

        <p>Selected language enum value: {selectedLanguage}</p>
      </div>

      <div className="m-auto">
        <p className="font-bold text-4xl">{korean}</p>
        <p className="font-bold text-4xl">{targetText}</p>
      </div>
    </div>
  );
}
