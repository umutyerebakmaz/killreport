import { Application, Container, Graphics, Texture } from 'pixi.js';

/** The texture is drawn once at this radius; every mark counter-scales from it. */
export const DOT_TEXTURE_RADIUS = 32;

export interface MapScene {
  app: Application;
  world: Container;
  edgesGalaxy: Graphics;
  edgesLocal: Graphics;
  systems: Container;
  celestials: Container;
  dot: Texture;
  labels: Container;
  destroy(): void;
}

/**
 * The container tree, built once. Every later call mutates it; nothing here is
 * rebuilt on a camera move, which is the point of putting the camera on the
 * root container's transform.
 *
 * Child order is draw order: gates under systems, so a dot is never hidden by
 * a line.
 */
export async function createScene(host: HTMLElement): Promise<MapScene> {
  const app = new Application();
  // `backgroundAlpha: 0` rather than a colour: the host div already carries
  // `bg-ground`, and the canvas covers it. Painting the canvas would restate
  // that colour in a second place, where it can only drift from the
  // `--color-ground` token the rest of the page is built on.
  await app.init({ backgroundAlpha: 0, resizeTo: host, antialias: true });
  host.appendChild(app.canvas);

  const world = new Container();
  app.stage.addChild(world);

  // On the stage, not in world: world's y scale is negative, so a BitmapText
  // inside it would render mirrored. Screen space also keeps the type at a
  // constant pixel size with no counter-scale, and the collision filter already
  // works in screen coordinates. Added after world, so names draw over dots.
  const labels = new Container();
  app.stage.addChild(labels);

  const edgesGalaxy = new Graphics();
  const edgesLocal = new Graphics();
  const systems = new Container();
  const celestials = new Container();
  world.addChild(edgesGalaxy, edgesLocal, systems, celestials);

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
    edgesLocal,
    systems,
    celestials,
    dot,
    labels,
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
