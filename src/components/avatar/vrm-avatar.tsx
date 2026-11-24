"use client";

import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import { motion } from "framer-motion";
import * as THREE from "three";

class WebGlErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

function useMouthOpen(
  analyserRef: MutableRefObject<AnalyserNode | null> | undefined
) {
  const dataRef = useRef<Uint8Array | null>(null);

  return () => {
    const analyser = analyserRef?.current;
    if (!analyser) return 0;
    if (!dataRef.current || dataRef.current.length !== analyser.frequencyBinCount) {
      dataRef.current = new Uint8Array(analyser.frequencyBinCount);
    }
    // @ts-expect-error ArrayBuffer vs ArrayBufferLike across TS lib versions
    analyser.getByteTimeDomainData(dataRef.current);
    let sum = 0;
    for (let i = 0; i < dataRef.current.length; i++) {
      const v = (dataRef.current[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / dataRef.current.length);
    return Math.min(1, rms * 6);
  };
}

function VrmModel({
  url,
  analyserRef,
}: {
  url: string;
  analyserRef?: MutableRefObject<AnalyserNode | null>;
}) {
  const [vrm, setVrm] = useState<VRM | null>(null);
  const getMouth = useMouthOpen(analyserRef);
  const mouthRef = useRef(0);

  useEffect(() => {
    let disposed = false;
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    loader.load(
      url,
      (gltf) => {
        if (disposed) return;
        const loaded = gltf.userData.vrm as VRM;
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.combineSkeletons(gltf.scene);
        loaded.scene.rotation.y = Math.PI;
        setVrm(loaded);
      },
      undefined,
      () => {
        if (!disposed) setVrm(null);
      }
    );
    return () => {
      disposed = true;
    };
  }, [url]);

  useFrame((_, delta) => {
    if (!vrm) return;
    const target = getMouth();
    mouthRef.current = THREE.MathUtils.damp(mouthRef.current, target, 18, delta);
    const expr = vrm.expressionManager;
    if (expr) {
      expr.setValue("aa", mouthRef.current);
      expr.setValue("oh", mouthRef.current * 0.35);
    }
    vrm.update(delta);
  });

  if (!vrm) return null;
  return <primitive object={vrm.scene} />;
}

function FlatMouthFallback({
  coverUrl,
  name,
  analyserRef,
  speaking,
}: {
  coverUrl: string;
  name: string;
  analyserRef?: MutableRefObject<AnalyserNode | null>;
  speaking?: boolean;
}) {
  const [open, setOpen] = useState(0);
  const dataRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const analyser = analyserRef?.current;
      let next = speaking ? 0.35 : 0.05;
      if (analyser) {
        if (
          !dataRef.current ||
          dataRef.current.length !== analyser.frequencyBinCount
        ) {
          dataRef.current = new Uint8Array(analyser.frequencyBinCount);
        }
        // @ts-expect-error ArrayBuffer vs ArrayBufferLike across TS lib versions
        analyser.getByteTimeDomainData(dataRef.current);
        let sum = 0;
        for (let i = 0; i < dataRef.current.length; i++) {
          const v = (dataRef.current[i] - 128) / 128;
          sum += v * v;
        }
        next = Math.min(1, Math.sqrt(sum / dataRef.current.length) * 6);
      }
      setOpen(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [analyserRef, speaking]);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={coverUrl} alt={name} className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink/40" />
      <motion.div
        className="absolute bottom-[28%] left-1/2 h-2 w-10 -translate-x-1/2 rounded-full bg-rose-300/80 shadow-[0_0_18px_rgba(244,114,182,0.55)]"
        animate={{
          scaleY: 0.35 + open * 2.2,
          scaleX: 0.85 + open * 0.4,
          opacity: 0.55 + open * 0.45,
        }}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
        style={{ originY: 0.5 }}
      />
    </div>
  );
}

export function VrmAvatar({
  vrmUrl,
  coverUrl,
  name,
  analyserRef,
  speaking,
  className,
}: {
  vrmUrl?: string | null;
  coverUrl: string;
  name: string;
  analyserRef?: MutableRefObject<AnalyserNode | null>;
  speaking?: boolean;
  className?: string;
}) {
  const [webglOk, setWebglOk] = useState(true);
  const hasVrm = Boolean(vrmUrl);

  const fallback = useMemo(
    () => (
      <FlatMouthFallback
        coverUrl={coverUrl}
        name={name}
        analyserRef={analyserRef}
        speaking={speaking}
      />
    ),
    [analyserRef, coverUrl, name, speaking]
  );

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const ok = Boolean(
        canvas.getContext("webgl2") || canvas.getContext("webgl")
      );
      if (!ok) setWebglOk(false);
    } catch {
      setWebglOk(false);
    }
  }, []);

  if (!hasVrm || !webglOk) {
    return <div className={className}>{fallback}</div>;
  }

  return (
    <div className={className}>
      <WebGlErrorBoundary fallback={fallback}>
        <Canvas
          camera={{ position: [0, 1.35, 1.6], fov: 28 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
        >
          <ambientLight intensity={0.85} />
          <directionalLight position={[2, 3, 2]} intensity={1.2} />
          <Suspense fallback={null}>
            <VrmModel url={vrmUrl!} analyserRef={analyserRef} />
          </Suspense>
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            minPolarAngle={Math.PI / 2.4}
            maxPolarAngle={Math.PI / 1.8}
          />
        </Canvas>
      </WebGlErrorBoundary>
    </div>
  );
}
