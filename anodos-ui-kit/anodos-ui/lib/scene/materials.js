/**
 * ANODOS Digital Twin — Materials & health visualisation.
 *
 * Every selectable part of the elevator owns a *unique* material instance, so a
 * component can change appearance (colour, emissive glow, opacity) without
 * affecting any other part. Materials here are the only place where a health
 * state is translated into something visible.
 *
 * Visual language
 *   normal    → base colour, faint teal emissive, full metalness
 *   warning   → amber tint, medium glow, slow pulse
 *   high_risk → red-orange tint, strong glow, faster pulse
 *   fault     → saturated red, strongest glow, fastest pulse
 *
 * Only the affected component is ever made prominent — there is no global
 * flashing, which keeps the 3D model readable during a demo.
 */

import * as THREE from 'three';
import { HEALTH } from './components.js';

/** How each health state looks. */
export const HEALTH_THEME = {
  [HEALTH.NORMAL]: {
    tint: 0x53e0b8,
    emissive: 0x0d3b33,
    emissiveIntensity: 0.18,
    colorMix: 0.06,
    roughness: 0.42,
    metalness: 0.72,
    pulseHz: 0,
    pulseAmount: 0
  },
  [HEALTH.WARNING]: {
    tint: 0xffb02e,
    emissive: 0x6a3d00,
    emissiveIntensity: 0.7,
    colorMix: 0.5,
    roughness: 0.5,
    metalness: 0.6,
    pulseHz: 0.9,
    pulseAmount: 0.22
  },
  [HEALTH.HIGH_RISK]: {
    tint: 0xff6a2e,
    emissive: 0x7a2400,
    emissiveIntensity: 1.05,
    colorMix: 0.68,
    roughness: 0.55,
    metalness: 0.55,
    pulseHz: 1.4,
    pulseAmount: 0.3
  },
  [HEALTH.FAULT]: {
    tint: 0xff002b,
    emissive: 0xff002b,
    emissiveIntensity: 2.5,
    colorMix: 0.95,
    roughness: 0.3,
    metalness: 0.4,
    pulseHz: 2.6,
    pulseAmount: 0.55
  }
};

export const SELECT_COLOR = 0x4fd1ff;
export const HOVER_COLOR = 0x9fe8ff;

/**
 * Creates the working material for a component mesh.
 *
 * @param {number} baseColor hex colour of the part when healthy
 * @param {object} [options]
 * @param {number} [options.roughness]
 * @param {number} [options.metalness]
 * @param {boolean} [options.transparent]
 * @param {number} [options.opacity]
 * @param {number} [options.emissiveIntensity]
 */
export function createComponentMaterial(baseColor, options = {}) {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(baseColor),
    roughness: options.roughness !== undefined ? options.roughness : 0.45,
    metalness: options.metalness !== undefined ? options.metalness : 0.7,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: options.emissiveIntensity !== undefined ? options.emissiveIntensity : 0.2,
    flatShading: options.flatShading === true,
    side: options.side || THREE.FrontSide
  });

  if (options.transparent) {
    material.transparent = true;
    material.opacity = options.opacity !== undefined ? options.opacity : 0.4;
  }
  if (options.depthWrite !== undefined) material.depthWrite = options.depthWrite;

  // Bookkeeping used by applyHealth / resetMaterial.
  material.userData.baseColor = new THREE.Color(baseColor);
  material.userData.baseRoughness = material.roughness;
  material.userData.baseMetalness = material.metalness;
  material.userData.baseEmissiveIntensity = material.emissiveIntensity;
  material.userData.healthState = HEALTH.NORMAL;
  material.userData.baseOpacity = material.opacity;

  return material;
}

/**
 * Wraps a material that came from an imported GLB in our bookkeeping, so health
 * visualisation works on it exactly like on the procedural materials.
 *
 * The material is cloned — the original stays untouched — and the current
 * colour/roughness become the "healthy" baseline.
 */
export function adoptMaterial(source) {
  if (!source) return source;
  if (Array.isArray(source)) return source.map((entry) => adoptMaterial(entry));

  const material = source.clone();
  if (!material.userData) material.userData = {};

  if (!material.userData.baseColor) {
    material.userData.baseColor = material.color ? material.color.clone() : new THREE.Color(0x9aa4b4);
    material.userData.baseRoughness = material.roughness !== undefined ? material.roughness : 0.5;
    material.userData.baseMetalness = material.metalness !== undefined ? material.metalness : 0.5;
    material.userData.baseEmissiveIntensity =
      material.emissiveIntensity !== undefined ? material.emissiveIntensity : 0;
    material.userData.baseOpacity = material.opacity;
    material.userData.healthState = HEALTH.NORMAL;
  }

  // Some imported materials have an emissive map; a flat emissive keeps the
  // health glow readable on top of it.
  if (!material.emissive) material.emissive = new THREE.Color(0x000000);
  return material;
}

/**
 * Applies a health state to a material, optionally blended by `strength` (0..1)
 * so the transition can be animated.
 */
export function applyHealth(material, state, strength = 1) {
  if (!material || !material.userData || !material.userData.baseColor) return;
  const theme = HEALTH_THEME[state] || HEALTH_THEME[HEALTH.NORMAL];
  const base = material.userData.baseColor;
  const targetMix = theme.colorMix * strength;

  // Blend the base colour toward the state tint.
  material.color.copy(base).lerp(new THREE.Color(theme.tint), targetMix);

  if (material.emissive) {
    material.emissive.set(theme.emissive);
    material.emissiveIntensity = theme.emissiveIntensity * strength;
  }
  material.roughness = THREE.MathUtils.lerp(
    material.userData.baseRoughness,
    theme.roughness,
    targetMix
  );
  material.metalness = THREE.MathUtils.lerp(
    material.userData.baseMetalness,
    theme.metalness,
    targetMix
  );
  material.userData.healthState = state;
}

/** Restores a material to its healthy appearance. */
export function resetMaterial(material) {
  if (!material || !material.userData || !material.userData.baseColor) return;
  material.color.copy(material.userData.baseColor);
  if (material.emissive) material.emissive.set(0x000000);
  material.emissiveIntensity = material.userData.baseEmissiveIntensity;
  material.roughness = material.userData.baseRoughness;
  material.metalness = material.userData.baseMetalness;
  material.userData.healthState = HEALTH.NORMAL;
}

/**
 * Slow, subtle pulse for unhealthy components. Deliberately gentle: the glow
 * breathes rather than flashes, and only the affected part animates.
 *
 * @param {THREE.Material} material
 * @param {number} elapsedSeconds
 */
export function updatePulse(material, elapsedSeconds) {
  if (!material || !material.userData) return;
  const theme = HEALTH_THEME[material.userData.healthState] || HEALTH_THEME[HEALTH.NORMAL];
  if (!theme.pulseHz || !material.emissive) return;
  const wave = (Math.sin(elapsedSeconds * Math.PI * 2 * theme.pulseHz) + 1) / 2; // 0..1
  const base = theme.emissiveIntensity;
  material.emissiveIntensity = base * (1 - theme.pulseAmount / 2 + wave * theme.pulseAmount);
}

/* ────────────────────────────────────────────────────────────────────────────
 * SHARED / ENVIRONMENT MATERIALS
 * ──────────────────────────────────────────────────────────────────────────── */

/** Transparent hoistway shell so the machinery stays visible inside. */
export function createShaftMaterial(color = 0x2b3a52) {
  return createComponentMaterial(color, {
    roughness: 0.85,
    metalness: 0.15,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}

/** Bright wireframe used for selection outlines and helper geometry. */
export function createOutlineMaterial(color = SELECT_COLOR, opacity = 0.55) {
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  material.userData.baseOpacity = opacity;
  return material;
}

/** Discrete emissive material for indicator strips (floor sills, door edges). */
export function createAccentMaterial(color, intensity = 1.2) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(color),
    emissiveIntensity: intensity,
    roughness: 0.35,
    metalness: 0.2
  });
}

/** Steel rope material (thin, slightly dark, no glow). */
export function createRopeMaterial(color = 0xcdbb92) {
  return createComponentMaterial(color, { roughness: 0.35, metalness: 0.95 });
}

/** Rubber / polymer material for guide shoes and buffers. */
export function createPolymerMaterial(color = 0x2f3742) {
  return createComponentMaterial(color, { roughness: 0.9, metalness: 0.05 });
}

/** Sets the highlight (selection) tint on an outline material. */
export function setOutlineColor(material, color, opacity = 0.55) {
  if (!material) return;
  material.color.set(color);
  material.opacity = opacity;
}

/** Recursively disposes geometries and materials under a root object. */
export function disposeObject(root) {
  if (!root) return;
  root.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    const material = child.material;
    if (!material) return;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose && entry.dispose());
    else if (material.dispose) material.dispose();
  });
}
