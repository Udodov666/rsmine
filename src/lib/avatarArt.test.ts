import { describe, it, expect } from 'vitest';
import { paletteFromPixels, hashBytes, randomSource, colorHex, mix } from './avatarArt';
describe('avatar art primitives', () => {
  it('extracts actual colors rather than a fixed color preset', () => {
    const p = paletteFromPixels(new Uint8ClampedArray([240,20,50,255,240,20,50,255,10,40,230,255,10,40,230,255]));
    expect(p.fallback).toBe(false);
    expect(p.colors).toContainEqual([240,20,50]);
    expect(p.colors).toContainEqual([10,40,230]);
  });
  it('uses neutral fallback for fully transparent images', () => {
    expect(paletteFromPixels(new Uint8ClampedArray([255,0,0,0])).fallback).toBe(true);
  });
  it('keeps monochrome avatars valid', () => {
    expect(paletteFromPixels(new Uint8ClampedArray([20,20,20,255,20,20,20,255])).colors).toEqual([[20,20,20]]);
  });
  it('hashes pixels deterministically and distinguishes changed content', () => {
    const a = new Uint8ClampedArray([1,2,3,255]);
    expect(hashBytes(a)).toBe(hashBytes(a));
    expect(hashBytes(a)).not.toBe(hashBytes(new Uint8ClampedArray([3,2,1,255])));
  });
  it('repeats the pseudorandom sequence for a fixed seed', () => {
    const a=randomSource(123), b=randomSource(123);
    expect([a(),a(),a()]).toEqual([b(),b(),b()]);
  });
  it('formats bounded colors and mixes pigments', () => {
    expect(colorHex([-10,100,300])).toBe('#0064ff');
    expect(mix([0,20,40],[100,120,140],.5)).toEqual([50,70,90]);
  });
});
