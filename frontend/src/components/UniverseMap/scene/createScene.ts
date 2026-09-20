import { Application, Container, Graphics, Texture } from 'pixi.js';

/** The texture is drawn once at this radius; every mark counter-scales from it. */
export const DOT_TEXTURE_RADIUS = 32;

/**
 * The backing-store scale, capped at 2.
 *
 * A 3x phone costs 2.25x the fragments for a difference nobody can see, and
 * every mark on this map is a minified texture, so the cap buys back fill rate
 * where nothing is gained by spending it.
 */
export function renderResolution(): number {
  return Math.min(window.devicePixelRatio || 1, 2);
}

export interface MapScene {
  app: Application;
  world: Container;
  edgesGalaxy: Graphics;
  edgesHighlight: Graphics;
  edgesLocal: Graphics;
  /** The owner discs the sovereignty logos are drawn on, under them. */
  discs: Container;
  systems: Container;
  celestials: Container;
  dot: Texture;
  destroy(): void;
}

/**
 * The container tree, built once. Every later call mutates it; nothing here is
 * rebuilt on a camera move, which is the point of putting the camera on the
 * root container's transform.
 *
 * Child order is draw order: gates under systems, so a dot is never hidden by
 * a line — and the hovered region's mesh over the galaxy one but still under
 * the systems, so the highlight covers the grey without ever covering a dot.
 */
export async function createScene(host: HTMLElement): Promise<MapScene> {
  const app = new Application();
  // `backgroundAlpha: 0` rather than a colour: the host div already carries
  // `bg-ground`, and the canvas covers it. Painting the canvas would restate
  // that colour in a second place, where it can only drift from the
  // `--color-ground` token the rest of the page is built on.
  await app.init({
    backgroundAlpha: 0,
    resizeTo: host,
    antialias: true,
    // Pixi defaults `resolution` to 1 and `autoDensity` to false, which on a
    // HiDPI screen draws the whole canvas at CSS size and lets the browser
    // upscale it — so every dot and gate line is drawn at half the detail the
    // display can show and then magnified back out by the compositor.
    //
    // Capped at 2: a 3x phone costs 2.25x the fragments for a difference no one
    // can see. `autoDensity` is what keeps the CSS size of the canvas where the
    // layout put it while the backing store grows.
    autoDensity: true,
    resolution: renderResolution(),
    // Nothing here uses Pixi's event system: `useMapPointer` binds native
    // listeners to the canvas and `pickSystem` does the hit testing in screen
    // space, because a counter-scaled sprite would need 5,241 hitAreas rewritten
    // at every zoom. Leaving the federated events on would walk the scene graph
    // on every pointermove for results nothing reads.
    eventFeatures: {
      move: false,
      globalMove: false,
      click: false,
      wheel: false,
    },
  });
  host.appendChild(app.canvas);

  const world = new Container();
  app.stage.addChild(world);

  const edgesGalaxy = new Graphics();
  const edgesHighlight = new Graphics();
  const edgesLocal = new Graphics();
  const discs = new Container();
  const systems = new Container();
  const celestials = new Container();
  // The discs are UNDER the systems, and that is the whole of the effect: a
  // logo is drawn on top of its owner's colour, so the colour is read from
  // behind the crest rather than from a tint multiplied into it.
  world.addChild(
    edgesGalaxy,
    edgesHighlight,
    edgesLocal,
    discs,
    systems,
    celestials,
  );

  // A 64 px disc minified to the 1.5 px floor is a 21x reduction, and a single
  // mip level sampled that far down is what aliasing looks like: deck.gl's
  // ScatterplotLayer drew the disc analytically and never had the problem.
  // `autoGenerateMipmaps` gives the reduction a filtered chain to sample from,
  // and `antialias` smooths the source disc's own edge, which matters at the
  // other end of the range where a system spans hundreds of pixels.
  const source = new Graphics().circle(0, 0, DOT_TEXTURE_RADIUS).fill(0xffffff);
  const dot = app.renderer.generateTexture({
    target: source,
    antialias: true,
    textureSourceOptions: { autoGenerateMipmaps: true },
  });
  // Scratch geometry: the texture is rasterised from it once and nothing holds
  // a reference afterwards.
  source.destroy(true);

  return {
    app,
    world,
    edgesGalaxy,
    edgesHighlight,
    edgesLocal,
    discs,
    systems,
    celestials,
    dot,
    // `app.destroy`'s texture pass only reaches textures a sprite in the
    // display tree still references. A scene torn down before any sprite is
    // built — an unmount racing `createScene`'s own init — never attaches
    // `dot` to anything, so it must be freed here directly rather than left
    // for a walk that will not find it.
    destroy: () => {
      dot.destroy(true);
      app.destroy(true, { children: true, texture: true });
    },
  };
}
