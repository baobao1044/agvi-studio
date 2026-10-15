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
  console.log("=== ALL 8 VERIFICATION SUITES PASSED ===");
}

verifyApiRoutes().catch((err) => {
  console.error(err);
  process.exit(1);
});
