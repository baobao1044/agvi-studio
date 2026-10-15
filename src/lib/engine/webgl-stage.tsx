"use client";

import React, { useEffect, useRef } from "react";
import { DesignDirectionPreset } from "../anti-slop/anti-slop-filter";

/**
 * Genuine GLSL Vertex & Fragment Shader Sources for the AGVI 3D Stage Pipeline.
 * Compiles under WebGL2 / WebGL1 contexts with 4x4 perspective + model-view matrices,
 * depth attenuation, and glowing vertex points.
 */
export const AGVI_WEBGL_VERTEX_SHADER = `
  attribute vec3 aPosition;
  attribute vec3 aColor;
  attribute float aPointSize;
  uniform mat4 uProjectionMatrix;
  uniform mat4 uModelViewMatrix;
  varying vec3 vColor;
  varying float vDepthAlpha;
  void main() {
    vec4 mvPosition = uModelViewMatrix * vec4(aPosition, 1.0);
    gl_Position = uProjectionMatrix * mvPosition;
    float dist = -mvPosition.z;
    vDepthAlpha = clamp((1050.0 - dist) / 780.0, 0.14, 0.96);
    vColor = aColor;
    gl_PointSize = max(2.0, aPointSize * (560.0 / max(100.0, dist)));
  }
`;

export const AGVI_WEBGL_FRAGMENT_SHADER = `
  precision mediump float;
  varying vec3 vColor;
  varying float vDepthAlpha;
  uniform float uIsPointPass;
  void main() {
    if (uIsPointPass > 0.5) {
      vec2 coord = gl_PointCoord - vec2(0.5);
      float r = length(coord);
      if (r > 0.5) discard;
      float glow = smoothstep(0.5, 0.08, r);
      gl_FragColor = vec4(vColor, vDepthAlpha * glow);
    } else {
      gl_FragColor = vec4(vColor, vDepthAlpha);
    }
  }
`;

export function parseHexColorToRgbNormalized(hex: string): [number, number, number] {
  const clean = (hex || "#CCFF00").replace("#", "").trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    return [
      Number.isFinite(r) ? r : 0.8,
      Number.isFinite(g) ? g : 1,
      Number.isFinite(b) ? b : 0,
    ];
  }
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [
    Number.isFinite(r) ? r : 0.8,
    Number.isFinite(g) ? g : 1,
    Number.isFinite(b) ? b : 0,
  ];
}

/**
 * Column-major 4x4 perspective matrix builder for WebGL uniform upload.
 */
export function buildPerspectiveMatrix4x4(
  fovRadians: number,
  aspect: number,
  near: number,
  far: number
): Float32Array {
  const f = 1.0 / Math.tan(fovRadians / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / Math.max(0.1, aspect), 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

/**
 * Column-major 4x4 model-view matrix with camera translationZ and Euler rotations (rotX, rotY, rotZ).
 */
export function buildModelViewMatrix4x4(
  rotX: number,
  rotY: number,
  rotZ: number,
  viewerDist = 680
): Float32Array {
  const cx = Math.cos(rotX), sx = Math.sin(rotX);
  const cy = Math.cos(rotY), sy = Math.sin(rotY);
  const cz = Math.cos(rotZ), sz = Math.sin(rotZ);

  // Combined rotation R = Rz * Rx * Ry
  const r00 = cz * cy - sz * sx * sy;
  const r01 = -sz * cx;
  const r02 = cz * sy + sz * sx * cy;

  const r10 = sz * cy + cz * sx * sy;
  const r11 = cz * cx;
  const r12 = sz * sy - cz * sx * cy;

  const r20 = -cx * sy;
  const r21 = sx;
  const r22 = cx * cy;

  return new Float32Array([
    r00, r10, r20, 0,
    r01, r11, r21, 0,
    r02, r12, r22, 0,
    0, 0, -viewerDist, 1,
  ]);
}

export interface Procedural3DMeshData {
  vertices: Array<[number, number, number]>;
  edges: Array<[number, number]>;
  gridSegments: Array<[[number, number, number], [number, number, number]]>;
  rotX: number;
  rotY: number;
  rotZ: number;
}

/**
 * Deterministically builds 3D vertex/edge geometry for a given `mode`, `frame`, and `fps`.
 * Shared between the WebGL shader pipeline, 2D fallback canvas, and headless frame compositor.
 */
export function buildProcedural3DMesh(
  mode: string,
  frame: number,
  fps: number
): Procedural3DMeshData {
  const t = frame / Math.max(1, fps);
  const rotY = t * 0.85;
  const rotX = Math.sin(t * 0.7) * 0.42 + 0.25;
  const rotZ = Math.cos(t * 0.45) * 0.18;

  const gridSegments: Array<[[number, number, number], [number, number, number]]> = [];
  for (let gx = -420; gx <= 420; gx += 84) {
    gridSegments.push([
      [gx, -210, -360],
      [gx, -210, 360],
    ]);
  }
  for (let gz = -360; gz <= 360; gz += 90) {
    const zShift = (((gz + frame * 5) % 720) + 720) % 720 - 360;
    gridSegments.push([
      [-420, -210, zShift],
      [420, -210, zShift],
    ]);
  }

  const vertices: Array<[number, number, number]> = [];
  const edges: Array<[number, number]> = [];

  if (mode.includes("tunnel") || mode.includes("fly")) {
    const rings = 7;
    const segs = 8;
    for (let r = 0; r < rings; r++) {
      const zDepth = (((r * 130 - frame * 11) % 910) + 910) % 910 - 455;
      const rad = 180 + Math.sin(r + t * 2) * 24;
      const baseIdx = vertices.length;
      for (let s = 0; s < segs; s++) {
        const ang = (s / segs) * Math.PI * 2;
        vertices.push([Math.cos(ang) * rad, Math.sin(ang) * rad, zDepth]);
        edges.push([baseIdx + s, baseIdx + ((s + 1) % segs)]);
      }
    }
  } else {
    const phi = (1 + Math.sqrt(5)) / 2;
    const rScale = 128;
    const rawIco: Array<[number, number, number]> = [
      [-1, phi, 0],
      [1, phi, 0],
      [-1, -phi, 0],
      [1, -phi, 0],
      [0, -1, phi],
      [0, 1, phi],
      [0, -1, -phi],
      [0, 1, -phi],
      [phi, 0, -1],
      [phi, 0, 1],
      [-phi, 0, -1],
      [-phi, 0, 1],
    ];
    for (const [vx, vy, vz] of rawIco) {
      vertices.push([vx * rScale, vy * rScale, vz * rScale]);
    }
    for (let i = 0; i < vertices.length; i++) {
      for (let j = i + 1; j < vertices.length; j++) {
        const dx = vertices[i][0] - vertices[j][0];
        const dy = vertices[i][1] - vertices[j][1];
        const dz = vertices[i][2] - vertices[j][2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < rScale * 2.15) {
          edges.push([i, j]);
        }
      }
    }
  }

  return { vertices, edges, gridSegments, rotX, rotY, rotZ };
}

interface WebGLCache {
  gl: WebGLRenderingContext | WebGL2RenderingContext;
  program: WebGLProgram;
  posBuffer: WebGLBuffer;
  colBuffer: WebGLBuffer;
  sizeBuffer: WebGLBuffer;
  aPosition: number;
  aColor: number;
  aPointSize: number;
  uProjectionMatrix: WebGLUniformLocation | null;
  uModelViewMatrix: WebGLUniformLocation | null;
  uIsPointPass: WebGLUniformLocation | null;
}

function initWebGLPipeline(canvas: HTMLCanvasElement): WebGLCache | null {
  try {
    const gl =
      (canvas.getContext("webgl2", {
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
      }) as WebGL2RenderingContext | null) ||
      (canvas.getContext("webgl", {
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
      }) as WebGLRenderingContext | null);

    if (!gl) return null;

    const compileShader = (type: number, source: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, AGVI_WEBGL_VERTEX_SHADER);
    const fs = compileShader(gl.FRAGMENT_SHADER, AGVI_WEBGL_FRAGMENT_SHADER);
    if (!vs || !fs) return null;

    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }

    const posBuffer = gl.createBuffer();
    const colBuffer = gl.createBuffer();
    const sizeBuffer = gl.createBuffer();
    if (!posBuffer || !colBuffer || !sizeBuffer) return null;

    return {
      gl,
      program,
      posBuffer,
      colBuffer,
      sizeBuffer,
      aPosition: gl.getAttribLocation(program, "aPosition"),
      aColor: gl.getAttribLocation(program, "aColor"),
      aPointSize: gl.getAttribLocation(program, "aPointSize"),
      uProjectionMatrix: gl.getUniformLocation(program, "uProjectionMatrix"),
      uModelViewMatrix: gl.getUniformLocation(program, "uModelViewMatrix"),
      uIsPointPass: gl.getUniformLocation(program, "uIsPointPass"),
    };
  } catch {
    return null;
  }
}

/**
 * Renders the 3D mesh into a 2D CanvasRenderingContext2D (used as clean fallback when WebGL is disabled
 * and by the unified Canvas 2D frame compositor).
 */
export function renderProcedural3DTo2DContext(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mode: string,
  frame: number,
  fps: number,
  palette: DesignDirectionPreset["palette"]
): void {
  const mesh = buildProcedural3DMesh(mode, frame, fps);
  const { rotX, rotY, rotZ } = mesh;

  const project3D = (x: number, y: number, z: number) => {
    const x1 = x * Math.cos(rotY) - z * Math.sin(rotY);
    const z1 = z * Math.cos(rotY) + x * Math.sin(rotY);
    const y2 = y * Math.cos(rotX) - z1 * Math.sin(rotX);
    const z2 = z1 * Math.cos(rotX) + y * Math.sin(rotX);
    const x3 = x1 * Math.cos(rotZ) - y2 * Math.sin(rotZ);
    const y3 = y2 * Math.cos(rotZ) + x1 * Math.sin(rotZ);

    const fov = 560 * (width / 960);
    const viewerDist = 680;
    const scale = fov / Math.max(80, viewerDist + z2);
    return {
      sx: width / 2 + x3 * scale,
      sy: height / 2 - y3 * scale,
      z: z2,
      scale,
    };
  };

  ctx.save();
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = Math.max(1, width / 960);
  ctx.globalAlpha = 0.35;
  for (const [pA, pB] of mesh.gridSegments) {
    const p1 = project3D(pA[0], pA[1], pA[2]);
    const p2 = project3D(pB[0], pB[1], pB[2]);
    ctx.beginPath();
    ctx.moveTo(p1.sx, p1.sy);
    ctx.lineTo(p2.sx, p2.sy);
    ctx.stroke();
  }

  const projected = mesh.vertices.map(([vx, vy, vz]) => project3D(vx, vy, vz));

  for (let eIdx = 0; eIdx < mesh.edges.length; eIdx++) {
    const [a, b] = mesh.edges[eIdx];
    const pa = projected[a];
    const pb = projected[b];
    if (!pa || !pb) continue;
    const avgZ = (pa.z + pb.z) * 0.5;
    const depthAlpha = Math.max(0.14, Math.min(0.85, (420 - avgZ) / 680));
    ctx.globalAlpha = depthAlpha;
    ctx.strokeStyle = eIdx % 5 === 0 ? palette.accent : palette.textMuted;
    ctx.lineWidth = (eIdx % 5 === 0 ? 2 : 1.1) * (width / 960);
    ctx.beginPath();
    ctx.moveTo(pa.sx, pa.sy);
    ctx.lineTo(pb.sx, pb.sy);
    ctx.stroke();
  }

  for (let i = 0; i < projected.length; i++) {
    const p = projected[i];
    const isAccent = i % 3 === 0;
    ctx.globalAlpha = Math.max(0.25, Math.min(0.95, (420 - p.z) / 650));
    ctx.fillStyle = isAccent ? palette.accent : palette.textPrimary;
    const radius = Math.max(2, (isAccent ? 4.5 : 2.8) * p.scale);
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Deterministic Frame-Locked WebGL2 / WebGL1 Shader Stage Renderer.
 * Compiles genuine GLSL vertex & fragment shaders, uploads 3D vertex/color/point-size buffers,
 * enables depth testing & alpha blending, and renders 3D wireframe polyhedra & floor grids.
 * Gracefully falls back to 2D Canvas projection only if WebGL is unavailable in the environment.
 */
export const ProceduralWebGL3DCanvas: React.FC<{
  mode: string;
  frame: number;
  fps: number;
  palette: DesignDirectionPreset["palette"];
}> = ({ mode, frame, fps, palette }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webglCacheRef = useRef<WebGLCache | null | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (webglCacheRef.current === undefined) {
      webglCacheRef.current = initWebGLPipeline(canvas);
    }

    const cache = webglCacheRef.current;
    if (cache) {
      const { gl, program, posBuffer, colBuffer, sizeBuffer } = cache;
      const w = canvas.width;
      const h = canvas.height;

      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.useProgram(program);

      const mesh = buildProcedural3DMesh(mode, frame, fps);
      const projMat = buildPerspectiveMatrix4x4(
        (50 * Math.PI) / 180,
        w / Math.max(1, h),
        20,
        2400
      );
      const mvMat = buildModelViewMatrix4x4(
        mesh.rotX,
        mesh.rotY,
        mesh.rotZ,
        680
      );

      gl.uniformMatrix4fv(cache.uProjectionMatrix, false, projMat);
      gl.uniformMatrix4fv(cache.uModelViewMatrix, false, mvMat);

      const accentRgb = parseHexColorToRgbNormalized(palette.accent);
      const mutedRgb = parseHexColorToRgbNormalized(palette.textMuted);
      const borderRgb = parseHexColorToRgbNormalized(palette.border);
      const primaryRgb = parseHexColorToRgbNormalized(palette.textPrimary);

      // Build Line Segments buffer (Grid + Mesh Edges)
      const totalLineVerts = mesh.gridSegments.length * 2 + mesh.edges.length * 2;
      const linePositions = new Float32Array(totalLineVerts * 3);
      const lineColors = new Float32Array(totalLineVerts * 3);
      const lineSizes = new Float32Array(totalLineVerts);

      let ptr = 0;
      for (const [pA, pB] of mesh.gridSegments) {
        linePositions.set(pA, ptr * 3);
        lineColors.set(borderRgb, ptr * 3);
        lineSizes[ptr] = 1.0;
        ptr++;

        linePositions.set(pB, ptr * 3);
        lineColors.set(borderRgb, ptr * 3);
        lineSizes[ptr] = 1.0;
        ptr++;
      }

      for (let eIdx = 0; eIdx < mesh.edges.length; eIdx++) {
        const [a, b] = mesh.edges[eIdx];
        const vA = mesh.vertices[a];
        const vB = mesh.vertices[b];
        if (!vA || !vB) continue;
        const col = eIdx % 5 === 0 ? accentRgb : mutedRgb;

        linePositions.set(vA, ptr * 3);
        lineColors.set(col, ptr * 3);
        lineSizes[ptr] = 1.0;
        ptr++;

        linePositions.set(vB, ptr * 3);
        lineColors.set(col, ptr * 3);
        lineSizes[ptr] = 1.0;
        ptr++;
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, linePositions, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(cache.aPosition);
      gl.vertexAttribPointer(cache.aPosition, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, colBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, lineColors, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(cache.aColor);
      gl.vertexAttribPointer(cache.aColor, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, lineSizes, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(cache.aPointSize);
      gl.vertexAttribPointer(cache.aPointSize, 1, gl.FLOAT, false, 0, 0);

      gl.uniform1f(cache.uIsPointPass, 0.0);
      gl.drawArrays(gl.LINES, 0, ptr);

      // Pass 2: Glowing 3D Vertex Nodes
      const ptCount = mesh.vertices.length;
      const ptPositions = new Float32Array(ptCount * 3);
      const ptColors = new Float32Array(ptCount * 3);
      const ptSizes = new Float32Array(ptCount);

      for (let i = 0; i < ptCount; i++) {
        const isAccent = i % 3 === 0;
        ptPositions.set(mesh.vertices[i], i * 3);
        ptColors.set(isAccent ? accentRgb : primaryRgb, i * 3);
        ptSizes[i] = isAccent ? 9.5 : 6.0;
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, ptPositions, gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(cache.aPosition, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, colBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, ptColors, gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(cache.aColor, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, ptSizes, gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(cache.aPointSize, 1, gl.FLOAT, false, 0, 0);

      gl.uniform1f(cache.uIsPointPass, 1.0);
      gl.drawArrays(gl.POINTS, 0, ptCount);
      return;
    }

    // Fallback to 2D Canvas projection only if WebGL is disabled in the current environment
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    renderProcedural3DTo2DContext(
      ctx2d,
      canvas.width,
      canvas.height,
      mode,
      frame,
      fps,
      palette
    );
  }, [mode, frame, fps, palette]);

  return (
    <canvas
      ref={canvasRef}
      width={960}
      height={540}
      data-renderer="webgl-glsl-stage"
      style={{
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
};
