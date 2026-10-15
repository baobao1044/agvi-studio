import assert from "node:assert/strict";
import {
  evaluateEasing,
  evaluateClipKeyframes,
  computeMotionVelocity,
  computeCameraShake,
  spring,
  interpolate,
} from "../src/lib/engine/agvi-engine";
import {
  validateAndNormalizeProject,
  getAgentSchemaDocumentation,
} from "../src/lib/schema/timeline-schema";
import {
  resolveDesignDirection,
  enforceAntiSlopOnProject,
} from "../src/lib/anti-slop/anti-slop-filter";
import { STARTER_TEMPLATES } from "../src/lib/schema/starter-templates";
import {
  compilePromptToStoryboard,
  executeAgentAction,
} from "../src/lib/server/project-store";

console.log("=== AGVI 3D & High-Tempo Motion Engine Verification Suite ===");

// 1. Easing & Velocity Curves
const presets = [
  "linear",
  "ease-in-out",
  "expo-out",
  "expo-in",
  "whip",
  "back-out",
  "elastic",
  "bounce",
] as const;

for (const preset of presets) {
  assert.equal(evaluateEasing(preset, 0), 0, `${preset} at t=0 must be 0`);
  assert.ok(
    Math.abs(evaluateEasing(preset, 1) - 1) < 1e-6,
    `${preset} at t=1 must be 1`
  );
  // Clamping out-of-bounds
  assert.equal(evaluateEasing(preset, -5), 0);
  assert.ok(Math.abs(evaluateEasing(preset, 5) - 1) < 1e-6);
}
// Verify back-out overshoots > 1.0 around t=0.6
assert.ok(evaluateEasing("back-out", 0.6) > 1.01, "back-out should overshoot > 1");
// Verify whip has steep midpoint slope
const whipSlopeMid =
  (evaluateEasing("whip", 0.52) - evaluateEasing("whip", 0.48)) / 0.04;
assert.ok(whipSlopeMid > 2.0, `whip midpoint slope (${whipSlopeMid}) > 2.0`);
console.log("[PASS] 1. Easing & Velocity Graph Curves");

// 2. Multi-Keyframe 3D Interpolation & Sparse Keyframe Edge Cases
const defaultTf = {
  x: 0,
  y: 0,
  z: 0,
  scale: 1,
  rotation: 0,
  rotateX: 0,
  rotateY: 0,
  opacity: 1,
  blur: 0,
};

// Empty keyframes fallback
assert.deepEqual(evaluateClipKeyframes(undefined, 0.5, defaultTf), defaultTf);
assert.deepEqual(evaluateClipKeyframes([], 0.5, defaultTf), defaultTf);

// Sparse multi-axis keyframes (KF1 defines x & z, KF2 defines rotateY & z)
const sparseKfs = [
  { offset: 0.8, rotateY: 40, z: 200, easing: "linear" as const },
  { offset: 0.2, x: -30, z: -200, easing: "linear" as const },
];
const evalMid = evaluateClipKeyframes(sparseKfs, 0.5, defaultTf);
assert.equal(evalMid.x, -30, "Single keyframe property x holds constant");
assert.equal(evalMid.rotateY, 40, "Single keyframe property rotateY holds constant");
assert.ok(Math.abs(evalMid.z - 0) < 1e-5, "z interpolates linearly from -200 to +200 at p=0.5");

// Duplicate offset edge case (no NaN / division by zero)
const dupKfs = [
  { offset: 0.5, z: -100 },
  { offset: 0.5, z: 300 },
];
const evalDup = evaluateClipKeyframes(dupKfs, 0.5, defaultTf);
assert.ok(Number.isFinite(evalDup.z), "Duplicate keyframe offsets must not produce NaN");

// Velocity calculation
const vel = computeMotionVelocity(
  { x: -100, y: 0, z: -300, scale: 0.8, rotation: 0, rotateX: 20, rotateY: -30 },
  { x: 0, y: 10, z: 0, scale: 1.0, rotation: 5, rotateX: 0, rotateY: 0 }
);
assert.ok(vel.speed > 50, `Expected high motion speed, got ${vel.speed}`);
console.log("[PASS] 2. Multi-Keyframe 3D Track & Sparse Keyframe Edge Cases");

// 3. Camera Shake & Spring Solver
const shake0 = computeCameraShake(0, 60, 1, 14);
const shakeMid = computeCameraShake(4, 60, 1, 14);
const shakeAfter = computeCameraShake(20, 60, 1, 14);
assert.ok(Math.hypot(shake0.dx, shake0.dy) > Math.hypot(shakeMid.dx, shakeMid.dy));
assert.deepEqual(shakeAfter, { dx: 0, dy: 0, drot: 0 });
assert.equal(spring({ frame: 0, fps: 60, from: 0, to: 1 }), 0);
assert.ok(Math.abs(spring({ frame: 120, fps: 60, from: 0, to: 1 }) - 1) < 0.01);
assert.equal(interpolate(5, [0, 10], [0, 100]), 50);
console.log("[PASS] 3. Deterministic Camera Impact Shake & Harmonic Spring");

// 4. Schema Normalization & OpenAI Tool Specs
const normRes = validateAndNormalizeProject({
  id: "test-3d-norm",
  name: "3D Normalization Test",
  canvas: { aspectRatio: "16:9", fps: 60, duration: 5 },
  tracks: [
    {
      type: "text",
      clips: [
        {
          id: "c1",
          type: "text",
          text: "HELLO 3D",
          textEffect: "kinetic-char-3d",
          sceneTransition: "3d-cube-spin",
          transform: { x: -10, y: 5, z: 120, rotateX: 15, rotateY: -20, scale: 1.1, rotation: 0 },
          filter: { motionBlur: 0.8, chromaticAberration: 0.5, cameraShake: 0.4 },
          keyframes: [{ offset: 0, z: -300, easing: "whip" }, { offset: 1, z: 120, easing: "expo-out" }],
        },
      ],
    },
  ],
});
assert.equal(normRes.valid, true);
const normClip = normRes.normalizedProject!.tracks[0].clips[0];
assert.equal(normClip.transform.z, 120);
assert.equal(normClip.transform.rotateX, 15);
assert.equal(normClip.transform.rotateY, -20);
assert.equal(normClip.keyframes?.length, 2);

const docs = getAgentSchemaDocumentation();
assert.ok(
  docs.supportedActions.some((a) => a.action === "choreograph_3d_kinetic_scene")
);
assert.ok(
  docs.openaiToolDefinitions.some(
    (t) => t.function.name === "agvi_choreograph_3d_kinetic_scene"
  )
);
console.log("[PASS] 4. 3D Schema Normalization & Agent Tool Documentation");

// 5. Anti-Slop Preservation of High-Tempo 3D Effects
const dirVi = resolveDesignDirection(undefined, "Chuyển sang làm motion graphics nhịp độ cao, 3D các thứ");
assert.equal(dirVi.id, "kinetic-3d-keynote");
assert.equal(dirVi.energy, 10);
assert.equal(dirVi.motion, 10);

const k3dTemplate = STARTER_TEMPLATES["kinetic-3d-keynote"];
assert.ok(k3dTemplate, "kinetic-3d-keynote starter template exists");
assert.equal(k3dTemplate.canvas.fps, 60);
const audited = enforceAntiSlopOnProject(k3dTemplate, {
  directionId: "kinetic-3d-keynote",
});
const titleClip = audited.project.tracks
  .find((t) => t.type === "text")!
  .clips[0];
assert.equal(
  titleClip.type === "text" ? titleClip.textEffect : "",
  "kinetic-char-3d",
  "Anti-slop gate must preserve kinetic-char-3d"
);
console.log("[PASS] 5. Anti-Slop Gate Preserves 10/10 Kinetic 3D Effects");

// 6. Prompt-to-Storyboard Compiler (Vietnamese & English 3D Prompts)
const sb = compilePromptToStoryboard(
  "Dựng video Motion Graphics 3D nhịp độ cao 60fps với Camera Orbit 3D và Multi-Keyframe Whip"
);
assert.equal(sb.designDirection, "kinetic-3d-keynote");
assert.equal(sb.scenes.length, 4);
assert.equal(sb.scenes[0].cameraMotion, "hyper-push-in");
assert.ok((sb.scenes[0].keyframes?.length ?? 0) >= 3);
console.log("[PASS] 6. Prompt-to-Storyboard 3D Compiler");

// 7. Agent Action Execution (choreograph_3d_kinetic_scene & apply_template)
const actRes = executeAgentAction({
  action: "choreograph_3d_kinetic_scene",
  cameraMotion: "orbit-3d-left",
  sceneTransition: "3d-cube-spin",
  textEffect: "kinetic-char-3d",
});
assert.equal(actRes.project.canvas.fps, 60);
assert.equal(actRes.project.agentMeta?.designDirection, "kinetic-3d-keynote");

// Reset store back to clean kinetic-3d-keynote showcase template
const resetRes = executeAgentAction({
  action: "apply_template",
  templateId: "kinetic-3d-keynote",
});
assert.equal(resetRes.project.id, "proj-kinetic-3d");
console.log("[PASS] 7. 1-Call choreograph_3d_kinetic_scene & Store Persistence");

// 8. Next.js API Route Handlers (/api/schema, /api/agent/actions, /api/agent/generate, /api/projects, /api/render)
async function verifyApiRoutes() {
  const { NextRequest } = await import("next/server");
  const schemaRoute = await import("../src/app/api/schema/route");
  const actionsRoute = await import("../src/app/api/agent/actions/route");
  const generateRoute = await import("../src/app/api/agent/generate/route");
  const projectsRoute = await import("../src/app/api/projects/route");
  const renderRoute = await import("../src/app/api/render/route");

  const schemaRes = await schemaRoute.GET();
  const schemaJson = await schemaRes.json();
  assert.equal(schemaJson.ok, true);
  assert.ok(schemaJson.documentation.engine.includes("3D"));

  const actReq = new NextRequest("http://localhost:3000/api/agent/actions", {
    method: "POST",
    body: JSON.stringify({
      action: "choreograph_3d_kinetic_scene",
      cameraMotion: "whip-pan-3d",
      sceneTransition: "zoom-punch",
      textEffect: "kinetic-word-stomp",
    }),
    headers: { "content-type": "application/json" },
  });
  const actResHttp = await actionsRoute.POST(actReq);
  const actJson = await actResHttp.json();
  assert.equal(actJson.ok, true);
  assert.equal(actJson.project.canvas.fps, 60);

  const genReq = new NextRequest("http://localhost:3000/api/agent/generate", {
    method: "POST",
    body: JSON.stringify({
      prompt: "Dựng video Motion Graphics 3D nhịp độ cao 60fps với Camera Orbit 3D",
      aspectRatio: "16:9",
      designDirection: "kinetic-3d-keynote",
    }),
    headers: { "content-type": "application/json" },
  });
  const genResHttp = await generateRoute.POST(genReq);
  const genJson = await genResHttp.json();
  assert.equal(genJson.ok, true);
  assert.equal(genJson.project.agentMeta.designDirection, "kinetic-3d-keynote");

  const renderReq = new NextRequest("http://localhost:3000/api/render", {
    method: "POST",
    body: JSON.stringify({ format: "webm" }),
    headers: { "content-type": "application/json" },
  });
  const renderResHttp = await renderRoute.POST(renderReq);
  const renderJson = await renderResHttp.json();
  assert.equal(renderJson.ok, true);
  assert.equal(renderJson.job.fps, 60);

  // Verify set_design_direction updates canvas backgroundColor, clip accent colors, AND procedural://* image src
  executeAgentAction({
    action: "add_clip",
    trackType: "image",
    clip: {
      id: "test-proc-img",
      name: "Procedural Backdrop",
      type: "image",
      startTime: 0,
      duration: 5,
      opacity: 1,
      src: "procedural://swiss-industrial",
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      enterAnimation: { type: "none", duration: 0 },
      exitAnimation: { type: "none", duration: 0 },
    },
  });
  const dirSwitchRes = executeAgentAction({
    action: "set_design_direction",
    designDirection: "warm-editorial",
  });
  assert.equal(dirSwitchRes.project.canvas.backgroundColor, "#141311");
  const badgeAfterSwitch = dirSwitchRes.project.tracks
    .flatMap((t) => t.clips)
    .find((c) => c.type === "shape" && c.shapeVariant === "badge");
  assert.equal(
    badgeAfterSwitch?.type === "shape" ? badgeAfterSwitch.accentColor : "",
    "#E03C1F"
  );
  const procImageAfterSwitch = dirSwitchRes.project.tracks
    .flatMap((t) => t.clips)
    .find((c) => c.id === "test-proc-img");
  assert.equal(
    procImageAfterSwitch?.type === "image" ? procImageAfterSwitch.src : "",
    "procedural://warm-editorial",
    "set_design_direction must update procedural://* image clips to the new direction"
  );

  // Restore clean default template in store
  executeAgentAction({
    action: "apply_template",
    templateId: "kinetic-3d-keynote",
  });

  const projResHttp = await projectsRoute.GET();
  const projJson = await projResHttp.json();
  assert.equal(projJson.ok, true);
  assert.equal(projJson.activeProjectId, "proj-kinetic-3d");

  const projectByIdRoute = await import("../src/app/api/projects/[id]/route");
  const projByIdRes = await projectByIdRoute.GET(
    new NextRequest("http://localhost:3000/api/projects/proj-kinetic-3d"),
    { params: Promise.resolve({ id: "proj-kinetic-3d" }) }
  );
  const projByIdJson = await projByIdRes.json();
  assert.equal(projByIdJson.ok, true);
  assert.equal(projByIdJson.project.id, "proj-kinetic-3d");

  console.log("[PASS] 8. Next.js REST API Route Handlers (/api/schema, /api/agent/actions, /api/agent/generate, /api/render, /api/projects, /api/projects/[id])");

  // 9. Unified Frame Compositor & WebGL Shader / Matrix Pipeline
  const {
    inspectFrameComposition,
    renderProjectFrameToCanvas,
  } = await import("../src/lib/engine/frame-compositor");
  const {
    AGVI_WEBGL_VERTEX_SHADER,
    AGVI_WEBGL_FRAGMENT_SHADER,
    buildPerspectiveMatrix4x4,
    buildModelViewMatrix4x4,
    buildProcedural3DMesh,
  } = await import("../src/lib/engine/webgl-stage");

  assert.ok(
    AGVI_WEBGL_VERTEX_SHADER.includes("uProjection") &&
      AGVI_WEBGL_VERTEX_SHADER.includes("uModelView"),
    "WebGL vertex shader must declare 4x4 uProjection and uModelView uniforms"
  );
  assert.ok(
    AGVI_WEBGL_FRAGMENT_SHADER.includes("gl_FragColor"),
    "WebGL fragment shader must write gl_FragColor"
  );
  const perspMat = buildPerspectiveMatrix4x4(Math.PI / 3, 16 / 9, 1, 2400);
  const mvMat = buildModelViewMatrix4x4(0.3, -0.5, 0.1, 600);
  assert.equal(perspMat.length, 16);
  assert.equal(mvMat.length, 16);
  assert.equal(mvMat[14], -600);

  for (const variant of [
    "3d-voxel-cube",
    "3d-wireframe-sphere",
    "3d-cyber-ring",
    "3d-prism-pyramid",
    "3d-starfield-tunnel",
  ] as const) {
    const mesh = buildProcedural3DMesh(variant, 30, 60);
    assert.ok(mesh.vertices.length > 0, `${variant} must generate 3D vertices`);
    assert.ok(
      mesh.edges.length > 0 || mesh.gridSegments.length > 0,
      `${variant} must generate edge or grid indices`
    );
  }

  // Inspect frame telemetry at frame=30 (0.5s), frame=120 (2.0s), frame=252 (4.2s) and out-of-bounds frame=5940 (99s)
  const f0 = inspectFrameComposition(k3dTemplate, 30);
  const f1 = inspectFrameComposition(k3dTemplate, 120);
  const f2 = inspectFrameComposition(k3dTemplate, 252);
  const fOut = inspectFrameComposition(k3dTemplate, 5940);
  assert.ok(f0.activeClipCount >= 2, "Frame 30 (0.5s) must have active clips");
  assert.ok(
    f1.activeTrackTypes.includes("video") || f1.activeTrackTypes.includes("shape"),
    "Frame 120 (2.0s) must include active video/shape tracks"
  );
  assert.ok(f2.activeClipCount >= 2, "Frame 252 (4.2s) must have active clips");
  assert.equal(fOut.activeClipCount, 0, "Out-of-bounds frame 5940 (99s) must have 0 active clips");

  // Exercise 2D canvas draw call path with a lightweight mock CanvasRenderingContext2D
  let drawCalls = 0;
  const noop = () => {
    drawCalls++;
  };
  const mockGradient = { addColorStop: () => {} };
  const mockCtx = new Proxy(
    {
      fillStyle: "#000",
      strokeStyle: "#fff",
      lineWidth: 1,
      globalAlpha: 1,
      font: "12px sans-serif",
      textAlign: "left",
      textBaseline: "middle",
      shadowColor: "transparent",
      shadowBlur: 0,
      createLinearGradient: () => mockGradient,
      createRadialGradient: () => mockGradient,
      measureText: (txt: string) => ({ width: txt.length * 10 }),
    },
    {
      get(target, prop) {
        if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
        return noop;
      },
    }
  ) as unknown as CanvasRenderingContext2D;

  renderProjectFrameToCanvas(mockCtx, k3dTemplate, 72);
  assert.ok(drawCalls > 25, `Expected >25 canvas draw operations per frame, got ${drawCalls}`);

  // Verify every single one of the 21 ShapeVariant types renders cleanly in renderProjectFrameToCanvas
  const allShapeVariants = [
    "rect",
    "circle",
    "badge",
    "progress-bar",
    "lower-third",
    "code-card",
    "gradient-backdrop",
    "kpi-counter",
    "bar-chart",
    "chat-simulation",
    "terminal-window",
    "bento-grid",
    "audio-waveform",
    "cyber-shader",
    "spotlight-callout",
    "process-stepper",
    "split-comparison",
    "hud-telemetry",
    "3d-carousel-stack",
    "kinetic-impact-wall",
    "3d-wireframe-prism",
  ] as const;

  for (const sv of allShapeVariants) {
    let svCalls = 0;
    const svCtx = new Proxy(
      {
        fillStyle: "#000",
        strokeStyle: "#fff",
        lineWidth: 1,
        globalAlpha: 1,
        font: "12px sans-serif",
        textAlign: "left",
        textBaseline: "middle",
        measureText: (txt: string) => ({ width: txt.length * 10 }),
      },
      {
        get(target, prop) {
          if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
          return () => {
            svCalls++;
          };
        },
      }
    ) as unknown as CanvasRenderingContext2D;

    const singleVariantProj = structuredClone(k3dTemplate);
    singleVariantProj.tracks = [
      {
        id: "t-sv",
        name: "Shape Variant Test",
        type: "shape",
        zIndex: 20,
        clips: [
          {
            id: `clip-${sv}`,
            name: `Variant ${sv}`,
            type: "shape",
            shapeVariant: sv,
            fill: "#161614",
            startTime: 0,
            duration: 4,
            opacity: 1,
            title: `Title ${sv}`,
            subtitle: `Subtitle ${sv}`,
            sceneTransition: "shutter-wipe",
            transform: { x: 0, y: 0, scale: 1, rotation: 0, width: 60 },
            enterAnimation: { type: "fade", duration: 0.2 },
            exitAnimation: { type: "fade", duration: 0.2 },
          },
        ],
      },
    ];
    renderProjectFrameToCanvas(svCtx, singleVariantProj, 10);
    assert.ok(svCalls > 5, `ShapeVariant "${sv}" must execute canvas drawing operations (got ${svCalls})`);
  }
  console.log("[PASS] 9. Unified Frame Compositor (All 21 ShapeVariants) & WebGL Shader / Matrix Pipeline");

  // 10. Honest RenderJob Lifecycle & Non-Fake CLI Render Pipeline
  const { spawnSync } = await import("node:child_process");
  const fs = await import("node:fs");
  const path = await import("node:path");

  // 10a. WebM render job without executeNow should be queued (not falsely completed)
  assert.equal(
    renderJson.job.status,
    "queued",
    "Render job without executeNow must start in 'queued' status"
  );
  assert.equal(renderJson.job.progress, 0);
  assert.ok((renderJson.job.frameCount ?? 0) > 0);

  // 10b. PATCH /api/render rejects invalid status & 0-byte completed artifacts, and clamps progress
  const badStatusReq = new NextRequest("http://localhost:3000/api/render", {
    method: "PATCH",
    body: JSON.stringify({
      jobId: renderJson.job.id,
      status: "bogus-status",
    }),
    headers: { "content-type": "application/json" },
  });
  const badStatusRes = await renderRoute.PATCH(badStatusReq);
  assert.equal(badStatusRes.status, 400, "Invalid RenderJob status must return 400");

  const zeroByteReq = new NextRequest("http://localhost:3000/api/render", {
    method: "PATCH",
    body: JSON.stringify({
      jobId: renderJson.job.id,
      status: "completed",
      fileSizeBytes: 0,
    }),
    headers: { "content-type": "application/json" },
  });
  const zeroByteRes = await renderRoute.PATCH(zeroByteReq);
  assert.equal(zeroByteRes.status, 400, "Completing RenderJob with 0 bytes must return 400");

  // Valid transition to completed with progress clamping (999 -> 100)
  const patchRenderReq = new NextRequest("http://localhost:3000/api/render", {
    method: "PATCH",
    body: JSON.stringify({
      jobId: renderJson.job.id,
      status: "completed",
      progress: 999,
      fileSizeBytes: 65536,
    }),
    headers: { "content-type": "application/json" },
  });
  const patchRenderRes = await renderRoute.PATCH(patchRenderReq);
  const patchRenderJson = await patchRenderRes.json();
  assert.equal(patchRenderJson.ok, true);
  assert.equal(patchRenderJson.job.status, "completed");
  assert.equal(patchRenderJson.job.progress, 100, "Progress must clamp to [0, 100]");
  assert.equal(patchRenderJson.job.fileSizeBytes, 65536);

  // 10c. JSON bundle synchronous export completes honestly with real file on disk
  const bundleRenderReq = new NextRequest("http://localhost:3000/api/render", {
    method: "POST",
    body: JSON.stringify({ format: "json-bundle" }),
    headers: { "content-type": "application/json" },
  });
  const bundleRenderRes = await renderRoute.POST(bundleRenderReq);
  const bundleRenderJson = await bundleRenderRes.json();
  assert.equal(bundleRenderJson.ok, true);
  assert.equal(bundleRenderJson.job.status, "completed");
  assert.ok((bundleRenderJson.job.fileSizeBytes ?? 0) > 500);

  // 10d. CLI script for .json output succeeds and writes real timeline bundle + manifest
  const testJsonOut = path.join(process.cwd(), "out", "verify-cli-bundle.json");
  const cliJsonRun = spawnSync(
    process.execPath,
    [
      path.join(process.cwd(), "scripts", "render-ffmpeg.mjs"),
      "--project",
      "proj-kinetic-3d",
      "--output",
      testJsonOut,
    ],
    { encoding: "utf8" }
  );
  assert.equal(cliJsonRun.status, 0, "CLI .json export must exit 0");
  assert.ok(fs.existsSync(testJsonOut), "CLI .json bundle file must exist");
  try {
    fs.unlinkSync(testJsonOut);
  } catch {
    // ignore cleanup error
  }

  // 10e. Check if ffmpeg is installed; if not, CLI video export MUST fail honestly (exit 1) and NOT write a fake stub
  const ffmpegProbe = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  if (ffmpegProbe.status !== 0) {
    const testFakeVideoOut = path.join(process.cwd(), "out", "verify-no-fake.webm");
    try {
      if (fs.existsSync(testFakeVideoOut)) fs.unlinkSync(testFakeVideoOut);
    } catch {
      // ignore
    }
    const cliVideoRun = spawnSync(
      process.execPath,
      [
        path.join(process.cwd(), "scripts", "render-ffmpeg.mjs"),
        "--project",
        "proj-kinetic-3d",
        "--output",
        testFakeVideoOut,
      ],
      { encoding: "utf8" }
    );
    assert.notEqual(
      cliVideoRun.status,
      0,
      "CLI video export without FFmpeg must fail honestly with non-zero exit code"
    );
    assert.equal(
      fs.existsSync(testFakeVideoOut),
      false,
      "CLI must NOT write a fake header-only .webm file when FFmpeg is unavailable"
    );
  }
  console.log("[PASS] 10. Honest RenderJob Lifecycle & Non-Fake CLI Render Pipeline");

  // 11. API Security (Authentication, Rate Limiting, Payload Cap) & Atomic Store Mutex
  const { resetRateLimitBuckets } = await import("../src/lib/server/security");
  const { withStoreWriteLock } = await import("../src/lib/server/project-store");

  // 11a. API Key authentication guard when AGVI_API_KEY is configured
  const prevApiKey = process.env.AGVI_API_KEY;
  process.env.AGVI_API_KEY = "test-secret-key-999";
  try {
    const unauthReq = new NextRequest("http://localhost:3000/api/projects", {
      method: "POST",
      body: JSON.stringify({ name: "Unauthorized Project" }),
      headers: { "content-type": "application/json" },
    });
    const unauthRes = await projectsRoute.POST(unauthReq);
    assert.equal(unauthRes.status, 401, "Missing API key must return 401");

    const authReq = new NextRequest("http://localhost:3000/api/projects", {
      method: "POST",
      body: JSON.stringify({ templateId: "kinetic-3d-keynote" }),
      headers: {
        "content-type": "application/json",
        "x-api-key": "test-secret-key-999",
      },
    });
    const authRes = await projectsRoute.POST(authReq);
    assert.equal(authRes.status, 200, "Valid x-api-key must return 200");
  } finally {
    if (prevApiKey === undefined) {
      delete process.env.AGVI_API_KEY;
    } else {
      process.env.AGVI_API_KEY = prevApiKey;
    }
  }

  // 11b. Sliding-window rate limiter returns 429 when limit exceeded
  resetRateLimitBuckets();
  const prevMax = process.env.AGVI_RATE_LIMIT_MAX;
  process.env.AGVI_RATE_LIMIT_MAX = "2";
  try {
    for (let i = 0; i < 2; i++) {
      const okReq = new NextRequest("http://localhost:3000/api/projects", {
        method: "POST",
        body: JSON.stringify({ templateId: "kinetic-3d-keynote" }),
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.42",
        },
      });
      const okRes = await projectsRoute.POST(okReq);
      assert.equal(okRes.status, 200);
    }
    const limitedReq = new NextRequest("http://localhost:3000/api/projects", {
      method: "POST",
      body: JSON.stringify({ templateId: "kinetic-3d-keynote" }),
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.42",
      },
    });
    const limitedRes = await projectsRoute.POST(limitedReq);
    assert.equal(limitedRes.status, 429, "Exceeding rate limit must return 429");
  } finally {
    if (prevMax === undefined) {
      delete process.env.AGVI_RATE_LIMIT_MAX;
    } else {
      process.env.AGVI_RATE_LIMIT_MAX = prevMax;
    }
    resetRateLimitBuckets();
  }

  // 11c. Concurrent write mutex serializes operations in strict order
  const order: number[] = [];
  await Promise.all([
    withStoreWriteLock(async () => {
      await new Promise((r) => setTimeout(r, 15));
      order.push(1);
    }),
    withStoreWriteLock(async () => {
      order.push(2);
    }),
  ]);
  assert.deepEqual(order, [1, 2], "withStoreWriteLock must serialize concurrent mutations");
  console.log("[PASS] 11. API Auth (401/200), Rate Limiting (429), and Atomic Store Write Mutex");

  // 12. Dual-Mode Storyboard Director (Heuristic Fallback + Mock LLM Provider + Malformed JSON Recovery) & Procedural Audio Schedule
  const { compilePromptToStoryboardWithLLM } = await import(
    "../src/lib/server/llm-director"
  );
  const { buildProjectAudioSchedule } = await import(
    "../src/lib/audio/procedural-sound-engine"
  );

  const llmFallbackRes = await compilePromptToStoryboardWithLLM(
    "Kinetic 3D product reveal with 60fps camera orbit",
    "16:9",
    "kinetic-3d-keynote"
  );
  assert.equal(llmFallbackRes.compilerMode, "deterministic-heuristic");
  assert.equal(llmFallbackRes.scenes.length, 4);

  // Test LLM provider path with mocked fetch (valid JSON response + malformed JSON recovery)
  const origFetch = globalThis.fetch;
  const prevOpenAiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-mock-verification-key";
  try {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: "LLM Bespoke 3D Architecture",
                  aspectRatio: "16:9",
                  designDirection: "kinetic-3d-keynote",
                  scenes: [
                    {
                      duration: 4,
                      layoutPattern: "statement-only",
                      headline: "LLM Synthesized 3D Stage",
                      subheadline: "Structured JSON output from OpenAI Director",
                      narration: "Scene one generated by LLM director",
                      cameraMotion: "orbit-3d-left",
                      sceneTransition: "3d-cube-spin",
                      textEffect: "kinetic-char-3d",
                      widgetType: "3d-carousel-stack",
                      lowerThirdTitle: "01 / LLM DIRECTOR",
                    },
                  ],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )) as typeof fetch;

    const llmSuccess = await compilePromptToStoryboardWithLLM(
      "Build a bespoke 3D architecture showcase",
      "16:9",
      "kinetic-3d-keynote"
    );
    assert.equal(llmSuccess.compilerMode, "llm-provider");
    assert.equal(llmSuccess.providerName, "openai");
    assert.equal(llmSuccess.title, "LLM Bespoke 3D Architecture");
    assert.equal(llmSuccess.scenes[0].headline, "LLM Synthesized 3D Stage");

    // Verify POST /api/agent/actions with action: "generate_from_prompt" also invokes LLM compiler
    const actionGenReq = new NextRequest("http://localhost:3000/api/agent/actions", {
      method: "POST",
      body: JSON.stringify({
        action: "generate_from_prompt",
        prompt: "Build a bespoke 3D architecture showcase",
      }),
      headers: { "content-type": "application/json" },
    });
    const actionGenRes = await actionsRoute.POST(actionGenReq);
    const actionGenJson = await actionGenRes.json();
    assert.equal(actionGenJson.ok, true);
    assert.equal(actionGenJson.compilerMode, "llm-provider");
    assert.equal(actionGenJson.providerName, "openai");

    // Malformed / adversarial LLM JSON response must gracefully recover to deterministic-heuristic
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "```json\n{ malformed_json: true " } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )) as typeof fetch;

    const llmRecovered = await compilePromptToStoryboardWithLLM(
      "Recover from broken JSON",
      "16:9",
      "kinetic-3d-keynote"
    );
    assert.equal(llmRecovered.compilerMode, "deterministic-heuristic");
    assert.equal(llmRecovered.scenes.length, 4);
  } finally {
    globalThis.fetch = origFetch;
    if (prevOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = prevOpenAiKey;
    }
  }

  const audioEvents = buildProjectAudioSchedule(k3dTemplate);
  assert.ok(audioEvents.length >= 6, "Audio schedule must include beats and scene transition SFX");
  assert.ok(audioEvents.some((e) => e.type === "whoosh" || e.type === "sub-impact-drop"));
  console.log("[PASS] 12. Dual-Mode Storyboard Director (Live Mock + Malformed Fallback) & Procedural Audio Schedule");

  // Final cleanup: ensure active project is proj-kinetic-3d
  executeAgentAction({
    action: "apply_template",
    templateId: "kinetic-3d-keynote",
  });

  console.log("=== ALL 12 VERIFICATION SUITES PASSED ===");
}

verifyApiRoutes().catch((err) => {
  console.error(err);
  process.exit(1);
});
