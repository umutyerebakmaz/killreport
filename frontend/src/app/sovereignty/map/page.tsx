import { redirect } from 'next/navigation';

/**
 * The territory map was folded into the universe map's sovereignty layer:
 * one map, with the owners, the timers and the changes beside it. The route
 * stays so old links, bookmarks and the SOVEREIGNTY menu still arrive.
 */
export default function SovereigntyMapPage() {
  redirect('/map?layer=sovereignty');
}
