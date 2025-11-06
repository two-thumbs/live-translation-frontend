"use client";

import { LanguageEnum, languageOptions } from "@/enums/LanguageEnum";
import { instance } from "@/lib/axios";
import React, { useEffect, useRef, useState } from "react";

export default function Home() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const [korean, setKorean] = useState<string>();
  const [selectedLanguage, setSelectedLanguage] =
    useState<keyof typeof LanguageEnum>("ENGLISH");
  const [targetText, setTargetText] = useState<string>();

  const options = languageOptions.map((value) => (
    <option key={value} value={value}>
      {value}
    </option>
  ));

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
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

        const { data } = await instance.post(
          `/reconize?lang=${selectedLanguage}`,
          event.data.buffer
        );

        setKorean(data.korean);
        setTargetText(data.target_text);
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
    <div className="h-screen flex flex-col">
      <div className="mb-auto flex w-min my-8 h-min mx-auto items-center gap-x-4">
        <div className="text-black bg-white py-1 px-4 rounded-md w-fit mx-auto">
          <select id="language-select" value={"KOREAN"}>
            <option>KOREAN</option>
            {options}
          </select>
        </div>
        <p>➞</p>
        <div className="text-black bg-white py-1 px-4 rounded-md w-fit mx-auto">
          <select
            id="language-select"
            value={selectedLanguage}
            onChange={handleLanguageChange}
          >
            {options}
          </select>
        </div>
      </div>
      <div className="mx-auto mt-12 mb-2 w-2/3 h-full bg-neutral-900 rounded-md p-2">
        <p>{korean}</p>
      </div>
      <div className="mx-auto mb-12 w-2/3 h-full bg-neutral-900 rounded-md p-2">
        <p>{targetText}</p>
      </div>
    </div>
  );
}
