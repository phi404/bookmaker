import type { Publication, BookAsset, AssetImage } from './model.js';
import type { RenderedPages } from './contracts.js';

export type LayoutImage = Pick<AssetImage, 'width' | 'height' | 'widthMm' | 'heightMm'> & { dataUrl?: string };
export type LayoutAsset = Pick<BookAsset, 'id' | 'name' | 'mediaType'> & { images: LayoutImage[] };
/** A derived, unsaveable input. Originals and display images stay in the canonical book. */
export type LayoutPublication = Pick<Publication, 'document' | 'styles' | 'style' | 'overrides' | 'runningElements' | 'specialPages' | 'pageOverrides'> & { assets?: LayoutAsset[] };

export function layoutInput(book: Publication): LayoutPublication {
  const { document, styles, style, overrides, runningElements, specialPages, pageOverrides } = book;
  return { document, styles, style, overrides, runningElements, ...(specialPages ? { specialPages } : {}), ...(pageOverrides ? { pageOverrides } : {}),
    assets: (book.assets ?? []).map(({ id, name, mediaType, images }) => ({ id, name, mediaType, images: images.map(({ width, height, widthMm, heightMm }) => ({ width, height, ...(widthMm !== undefined ? { widthMm } : {}), ...(heightMm !== undefined ? { heightMm } : {}) })) })) };
}
export function resolveLayoutAssets(result: RenderedPages, book: Pick<Publication, 'assets'>): RenderedPages {
  const assets = new Map((book.assets ?? []).map(asset => [asset.id, asset]));
  return { ...result, pages: result.pages.map(page => ({ ...page, ...(page.elements ? { elements: page.elements.map(element => {
    const image = element.sourceAssetId ? assets.get(element.sourceAssetId)?.images[(element.sourceAssetPage ?? 1) - 1] : undefined;
    return image && element.kind === 'image' ? { ...element, dataUrl: image.dataUrl } : element;
  }) } : {}) })) };
}
