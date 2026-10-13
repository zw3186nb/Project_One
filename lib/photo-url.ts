/** Public URL of a photo in Supabase Storage. Safe to use in browser code. */
export function photoUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${path}`;
}
