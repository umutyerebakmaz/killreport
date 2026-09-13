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
  await app.init({ background: 0x0b0d10, resizeTo: host, antialias: true });
  host.appendChild(app.canvas);

  const world = new Container();
  app.stage.addChild(world);

  const edgesGalaxy = new Graphics();
  const edgesLocal = new Graphics();
  const systems = new Container();
  const celestials = new Container();
  world.addChild(edgesGalaxy, edgesLocal, systems, celestials);

  const dot = app.renderer.generateTexture(
    new Graphics().circle(0, 0, DOT_TEXTURE_RADIUS).fill(0xffffff),
  );

  return {
    app,
    world,
    edgesGalaxy,
    edgesLocal,
    systems,
    celestials,
    dot,
    destroy: () => app.destroy(true, { children: true, texture: true }),
  };
}
