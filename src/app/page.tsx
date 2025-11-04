"use client";

import React, { useEffect, useRef, useState } from "react";

export default function Home() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const [audioData, setAudioData] = useState<number[]>([]);
  const [korean, setKorean] = useState<string>();
  const [english, setEnglish] = useState<string>();

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
        const newData = Array.from(event.data) as number[];
        setAudioData(newData);

        console.log("Speaking");

        const response = await fetch("/proto", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: event.data.buffer,
        });

        const body = await response.json();
        console.log(body);

        setKorean(body.korean);
        setEnglish(body.english);
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);
    };

    startRecording();

    return () => {
      workletNodeRef.current?.disconnect();
      audioContextRef.current?.close();
    };
  }, []);

  const data = {
    labels: audioData.map((_, i) => i),
    datasets: [
      {
        label: "Audio PCM Data",
        data: audioData,
        borderColor: "rgba(75,192,192,1)",
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  return (
    <div className="h-screen grid">
      <div className="m-auto">
        <p className="font-bold text-4xl">{korean}</p>
        <p className="font-bold text-4xl">{english}</p>
      </div>
    </div>
  );
}
