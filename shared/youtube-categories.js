/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The categories a YouTube video can be put in.
 *
 * YouTube's category is a broad genre from a short list, not a game — the
 * game is a separate field YouTube keeps to itself, which the API cannot set.
 * The list is fixed and its ids are the same everywhere, so it lives here
 * rather than being asked for: the editor shows it with no connection, and
 * the server checks a step against the same one it was built from.
 *
 * YouTube can ask for the list per region, and a region may refuse one or two
 * of these. A refused one comes back as an error in the log, and the category
 * is left as it was.
 */
export const YOUTUBE_CATEGORIES = [
  { id: '20', en: 'Gaming', es: 'Videojuegos' },
  { id: '22', en: 'People & Blogs', es: 'Gente y blogs' },
  { id: '24', en: 'Entertainment', es: 'Entretenimiento' },
  { id: '10', en: 'Music', es: 'Música' },
  { id: '27', en: 'Education', es: 'Educación' },
  { id: '28', en: 'Science & Technology', es: 'Ciencia y tecnología' },
  { id: '26', en: 'Howto & Style', es: 'Consejos y estilo' },
  { id: '23', en: 'Comedy', es: 'Comedia' },
  { id: '17', en: 'Sports', es: 'Deportes' },
  { id: '1', en: 'Film & Animation', es: 'Cine y animación' },
  { id: '2', en: 'Autos & Vehicles', es: 'Motor' },
  { id: '15', en: 'Pets & Animals', es: 'Mascotas y animales' },
  { id: '19', en: 'Travel & Events', es: 'Viajes y eventos' },
  { id: '25', en: 'News & Politics', es: 'Noticias y política' },
  { id: '29', en: 'Nonprofits & Activism', es: 'ONG y activismo' },
];

/** Whether an id is one of the above. */
export const isYoutubeCategory = (id) => YOUTUBE_CATEGORIES.some((c) => c.id === String(id));

/** A category's name, or the id itself for one this list does not know. */
export const youtubeCategoryName = (id, lang = 'en') => {
  const found = YOUTUBE_CATEGORIES.find((c) => c.id === String(id));
  return found ? (found[lang] || found.en) : String(id ?? '');
};
